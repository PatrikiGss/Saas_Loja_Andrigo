"""Pedidos: o carrinho convertido em compra."""

from __future__ import annotations

import uuid
from decimal import Decimal
from secrets import token_hex

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.utils import timezone

from carrinho.models import Carrinho, ItemCarrinho
from loja.models import Produto
from painel.models import CamposDeEndereco, Endereco, copiar_endereco
from pedidos.frete import ServicoFrete, cotar_servico


class StatusPedido(models.TextChoices):
    AGUARDANDO_PAGAMENTO = 'aguardando_pagamento', 'Aguardando pagamento'
    PAGO = 'pago', 'Pago'
    EM_PREPARACAO = 'em_preparacao', 'Em preparação'
    ENVIADO = 'enviado', 'Enviado'
    ENTREGUE = 'entregue', 'Entregue'
    CANCELADO = 'cancelado', 'Cancelado'


#: Para onde cada status pode ir. O que não está aqui não acontece.
TRANSICOES: dict[str, tuple[str, ...]] = {
    StatusPedido.AGUARDANDO_PAGAMENTO: (StatusPedido.PAGO, StatusPedido.CANCELADO),
    StatusPedido.PAGO: (StatusPedido.EM_PREPARACAO, StatusPedido.CANCELADO),
    StatusPedido.EM_PREPARACAO: (StatusPedido.ENVIADO, StatusPedido.CANCELADO),
    StatusPedido.ENVIADO: (StatusPedido.ENTREGUE,),
    StatusPedido.ENTREGUE: (),
    StatusPedido.CANCELADO: (),
}


class StatusPagamento(models.TextChoices):
    PENDENTE = 'pendente', 'Pendente'
    PAGO = 'pago', 'Pago'
    ESTORNADO = 'estornado', 'Estornado'


#: Teto de pedidos esperando pagamento por conta, para o checkout não virar
#: fábrica de pedido fantasma.
PEDIDOS_PENDENTES_MAXIMOS = 5


def gerar_numero() -> str:
    """Número do pedido, sempre gerado aqui: data mais sorteio."""
    return f'PED-{timezone.now():%Y%m%d}-{token_hex(3).upper()}'


class PedidoQuerySet(models.QuerySet):
    def fechar_carrinho(self, usuario, endereco: Endereco, servico: str) -> Pedido:
        """Converte o carrinho da conta em pedido.

        Tudo acontece em uma transação: ou sai o pedido inteiro, com itens e
        endereço congelados e o carrinho esvaziado, ou nada muda. A trava no
        carrinho põe dois checkouts simultâneos em fila, então o segundo
        encontra o carrinho vazio em vez de gerar um pedido repetido.

        O estoque não é tocado aqui: a baixa fica para quando o pagamento for
        integrado, que é o momento em que ela tem sentido.
        """
        with transaction.atomic():
            carrinho = Carrinho.objects.select_for_update().filter(usuario=usuario).first()
            itens = self._itens_conferidos(carrinho)
            self._conferir_pendentes(usuario)

            subtotal = sum(
                (item.produto.preco * item.quantidade for item in itens), Decimal('0.00')
            )
            opcao = cotar_servico(servico, endereco.uf, sum(item.quantidade for item in itens))

            pedido = self.create(
                usuario=usuario,
                endereco_origem=endereco,
                servico_frete=opcao.servico,
                prazo_frete_em_dias=opcao.prazo_em_dias,
                frete=opcao.preco,
                subtotal=subtotal,
                total=subtotal + opcao.preco,
            )
            EnderecoDeEntrega.objects.create(pedido=pedido, **copiar_endereco(endereco))
            ItemPedido.objects.bulk_create(
                [
                    ItemPedido(
                        pedido=pedido,
                        produto=item.produto,
                        sku=item.produto.sku,
                        nome=item.produto.nome,
                        preco_unitario=item.produto.preco,
                        quantidade=item.quantidade,
                    )
                    for item in itens
                ]
            )
            carrinho.itens.all().delete()
            return pedido

    @staticmethod
    def _itens_conferidos(carrinho: Carrinho | None) -> list[ItemCarrinho]:
        """Itens do carrinho, recusando carrinho vazio ou produto fora de venda."""
        itens = list(carrinho.itens.select_related('produto')) if carrinho else []
        if not itens:
            raise ValidationError({'carrinho': 'Carrinho vazio.'})

        if any(not item.produto.ativo for item in itens):
            raise ValidationError({'itens': 'Há produto indisponível no carrinho.'})

        return itens

    def _conferir_pendentes(self, usuario) -> None:
        """Recusa a conta que já acumulou pedidos esperando pagamento."""
        pendentes = self.filter(usuario=usuario, status=StatusPedido.AGUARDANDO_PAGAMENTO).count()
        if pendentes >= PEDIDOS_PENDENTES_MAXIMOS:
            raise ValidationError({'pedido': 'Há pedidos demais aguardando pagamento nesta conta.'})


class Pedido(models.Model):
    """Compra fechada.

    O endereço de entrega, e também nome, SKU e preço dos itens, são cópias do
    momento da compra: mudar o cadastro depois não mexe no histórico.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero = models.CharField(max_length=20, unique=True, editable=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='pedidos',
    )
    endereco_origem = models.ForeignKey(
        Endereco,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos',
    )

    status = models.CharField(
        max_length=25,
        choices=StatusPedido.choices,
        default=StatusPedido.AGUARDANDO_PAGAMENTO,
    )

    servico_frete = models.CharField(max_length=20, choices=ServicoFrete.choices)
    prazo_frete_em_dias = models.PositiveSmallIntegerField()
    frete = models.DecimalField(max_digits=10, decimal_places=2, validators=(MinValueValidator(0),))
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    status_pagamento = models.CharField(
        max_length=15,
        choices=StatusPagamento.choices,
        default=StatusPagamento.PENDENTE,
    )
    pagamento_id_externo = models.CharField(max_length=100, blank=True)
    pago_em = models.DateTimeField(null=True, blank=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    objects = PedidoQuerySet.as_manager()

    class Meta:
        ordering = ('-criado_em',)
        indexes = (models.Index(fields=('usuario', '-criado_em'), name='pedido_usuario_data_idx'),)
        # Não existe constraint comparando total com subtotal + frete: o
        # SQLite guarda DecimalField como float e a soma não bate na casa dos
        # centavos. O total sai de um único lugar, `fechar_carrinho`, e tem
        # teste garantindo que fecha.
        constraints = (
            models.CheckConstraint(
                condition=models.Q(subtotal__gt=0) & models.Q(frete__gte=0),
                name='pedido_valores_validos',
            ),
        )

    def __str__(self) -> str:
        return self.numero

    def save(self, *args, **kwargs) -> None:
        if not self.numero:
            self.numero = gerar_numero()
        super().save(*args, **kwargs)

    def pode_ir_para(self, status: str) -> bool:
        return status in TRANSICOES.get(self.status, ())

    @property
    def proximos_status(self) -> tuple[str, ...]:
        """Para onde a loja pode mover o pedido a partir de agora."""
        return TRANSICOES.get(self.status, ())

    @property
    def pode_ser_cancelado_pelo_cliente(self) -> bool:
        """Só enquanto espera pagamento.

        Depois de pago, cancelar exige estorno, que depende do gateway: aí
        quem cancela é a loja, pelo fluxo de status.
        """
        return self.status == StatusPedido.AGUARDANDO_PAGAMENTO

    def cancelar_pelo_cliente(self) -> None:
        """Cancela o pedido a pedido do próprio cliente.

        A troca é condicional no banco — só acontece se o status ainda for o de
        espera —, então um pagamento confirmado no mesmo instante não é
        atropelado por um cancelamento que leu o status antigo.
        """
        agora = timezone.now()
        trocados = Pedido.objects.filter(
            pk=self.pk, status=StatusPedido.AGUARDANDO_PAGAMENTO
        ).update(status=StatusPedido.CANCELADO, atualizado_em=agora)
        if not trocados:
            raise ValidationError({'status': 'Este pedido não pode mais ser cancelado.'})
        self.status = StatusPedido.CANCELADO
        self.atualizado_em = agora

    def alterar_status(self, novo_status: str) -> None:
        """Move o pedido no fluxo, recusando transição que não existe."""
        if not self.pode_ir_para(novo_status):
            raise ValidationError(
                {'status': f'Não é possível ir de {self.status} para {novo_status}.'}
            )
        self.status = novo_status
        self.save(update_fields=('status', 'atualizado_em'))

    def registrar_pagamento(self, identificador_externo: str) -> None:
        """Confirma o pagamento.

        É o ponto de entrada do futuro webhook do gateway, e é idempotente de
        propósito: reprocessar o mesmo evento não muda nada duas vezes.
        """
        if self.status_pagamento == StatusPagamento.PAGO:
            return

        self.status_pagamento = StatusPagamento.PAGO
        self.pagamento_id_externo = identificador_externo
        self.pago_em = timezone.now()
        campos = ['status_pagamento', 'pagamento_id_externo', 'pago_em', 'atualizado_em']

        if self.pode_ir_para(StatusPedido.PAGO):
            self.status = StatusPedido.PAGO
            campos.append('status')

        self.save(update_fields=campos)


class EnderecoDeEntrega(CamposDeEndereco):
    """Cópia do endereço no momento da compra.

    Fica em tabela própria, e não em colunas do pedido, porque o pedido já tem
    um campo `numero` e um endereço também tem: dois significados diferentes
    não podem dividir o mesmo nome.
    """

    pedido = models.OneToOneField(Pedido, on_delete=models.CASCADE, related_name='entrega')

    def __str__(self) -> str:
        return f'{self.logradouro}, {self.numero} - {self.cidade}/{self.uf}'


class ItemPedido(models.Model):
    """Linha da compra, com os dados comerciais congelados."""

    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='itens')
    produto = models.ForeignKey(Produto, on_delete=models.PROTECT, related_name='itens_de_pedido')
    sku = models.CharField(max_length=32)
    nome = models.CharField(max_length=120)
    preco_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    quantidade = models.PositiveIntegerField(validators=(MinValueValidator(1),))

    class Meta:
        ordering = ('id',)
        constraints = (
            models.UniqueConstraint(
                fields=('pedido', 'produto'),
                name='item_produto_unico_no_pedido',
            ),
            models.CheckConstraint(
                condition=models.Q(quantidade__gt=0) & models.Q(preco_unitario__gt=0),
                name='item_pedido_valores_positivos',
            ),
        )

    def __str__(self) -> str:
        return f'{self.quantidade} x {self.nome}'

    @property
    def subtotal(self) -> Decimal:
        """Calculado a partir de dois valores já congelados, nunca do produto."""
        return self.preco_unitario * self.quantidade
