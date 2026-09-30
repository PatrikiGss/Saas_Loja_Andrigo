"""Carrinho de compras do usuário autenticado."""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction

from loja.models import Produto

#: Teto por item, para que uma requisição não peça um valor absurdo.
QUANTIDADE_MAXIMA = 100


class CarrinhoQuerySet(models.QuerySet):
    def do_usuario(self, usuario) -> Carrinho:
        """Devolve o carrinho da conta, criando na primeira vez.

        O dono vem sempre da conta autenticada, nunca do payload, e o
        `OneToOne` garante no banco que ninguém tem dois carrinhos.
        """
        return self.get_or_create(usuario=usuario)[0]


class Carrinho(models.Model):
    """Carrinho de uma conta. Existe no máximo um por usuário."""

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='carrinho',
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    objects = CarrinhoQuerySet.as_manager()

    class Meta:
        ordering = ('-atualizado_em',)

    def __str__(self) -> str:
        return f'Carrinho de {self.usuario.get_username()}'

    @property
    def total(self) -> Decimal:
        """Soma os subtotais dos itens já carregados, sem consulta extra."""
        return sum((item.subtotal for item in self.itens.all()), Decimal('0.00'))

    def adicionar(self, produto: Produto, quantidade: int) -> ItemCarrinho:
        """Soma à quantidade do item existente ou cria o item.

        A trava é no próprio carrinho: duas requisições da mesma conta entram
        em fila, então o incremento não se perde e a unicidade do item não
        quebra. É uma linha por carrinho, e não uma trava global.
        """
        with transaction.atomic():
            Carrinho.objects.select_for_update().get(pk=self.pk)

            item = self.itens.filter(produto=produto).first()
            if item is None:
                item = ItemCarrinho(carrinho=self, produto=produto, quantidade=quantidade)
            else:
                item.quantidade += quantidade

            item.full_clean(validate_unique=False)
            item.save()
            return item


class ItemCarrinho(models.Model):
    """Produto e quantidade dentro de um carrinho.

    Guarda só a referência ao produto: nome, preço e estoque continuam vivendo
    na app loja, e o carrinho sempre lê o estado atual deles.
    """

    carrinho = models.ForeignKey(Carrinho, on_delete=models.CASCADE, related_name='itens')
    produto = models.ForeignKey(Produto, on_delete=models.PROTECT, related_name='itens_de_carrinho')
    quantidade = models.PositiveIntegerField(
        validators=(MinValueValidator(1), MaxValueValidator(QUANTIDADE_MAXIMA)),
    )
    adicionado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('adicionado_em',)
        constraints = (
            models.UniqueConstraint(
                fields=('carrinho', 'produto'),
                name='item_produto_unico_no_carrinho',
            ),
            models.CheckConstraint(
                condition=models.Q(quantidade__gte=1) & models.Q(quantidade__lte=QUANTIDADE_MAXIMA),
                name='item_quantidade_na_faixa',
            ),
        )

    def __str__(self) -> str:
        return f'{self.quantidade} x {self.produto.nome}'

    @property
    def subtotal(self) -> Decimal:
        return self.produto.preco * self.quantidade

    def clean(self) -> None:
        """O produto precisa estar à venda e ter estoque para a quantidade.

        A mensagem não diz quanto resta em estoque: essa informação não é
        pública no catálogo e não vai virar pública por uma mensagem de erro.
        """
        if self.produto_id is None or self.quantidade is None:
            return

        if not self.produto.ativo:
            raise ValidationError({'produto': 'Produto indisponível.'})

        if self.quantidade > self.produto.estoque:
            raise ValidationError({'quantidade': 'Quantidade acima do estoque disponível.'})
