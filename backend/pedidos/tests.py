"""Testes de pedido, checkout, estoque, frete, CEP e e-mail."""
from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch
from urllib.error import URLError

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from carrinho.models import Carrinho
from loja.models import Categoria, Produto, Subtipo
from painel.models import Endereco
from pedidos.cep import CepInvalido, ConsultaIndisponivel, consultar
from pedidos.frete import ServicoFrete, cotar_servico
from pedidos.models import ItemPedido, Pedido, StatusPagamento, StatusPedido

Usuario = get_user_model()

SENHA = 'Senha-Forte-2026'

RESPOSTA_VIACEP = {
    'cep': '01001-000',
    'logradouro': 'Praça da Sé',
    'complemento': 'lado ímpar',
    'bairro': 'Sé',
    'localidade': 'São Paulo',
    'uf': 'SP',
}


def criar_usuario(email: str, **campos) -> Usuario:
    return Usuario.objects.create_user(username=email, email=email, password=SENHA, **campos)


def autenticar(cliente: APIClient, usuario: Usuario) -> None:
    cliente.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(usuario)}')


def criar_endereco(usuario: Usuario, uf: str = 'SP', **campos) -> Endereco:
    dados = {
        'apelido': 'casa',
        'cep': '01001000',
        'logradouro': 'Praça da Sé',
        'numero': '100',
        'complemento': '',
        'bairro': 'Sé',
        'cidade': 'São Paulo',
        'uf': uf,
    }
    dados.update(campos)
    return Endereco.objects.create(usuario=usuario, **dados)


class BasePedidoTests(APITestCase):
    """Catálogo, conta, endereço e carrinho prontos para o checkout."""

    @classmethod
    def setUpTestData(cls) -> None:
        cls.subtipo = Subtipo.objects.create(
            nome='Pedido vape', slug='pedido-vape', categoria=Categoria.VAPE
        )

    @classmethod
    def criar_produto(cls, sku: str, preco: str = '100.00', estoque: int = 10) -> Produto:
        return Produto.objects.create(
            subtipo=cls.subtipo,
            sku=sku,
            nome=f'Produto {sku}',
            marca='Marca',
            preco=Decimal(preco),
            estoque=estoque,
        )

    def setUp(self) -> None:
        self.usuario = criar_usuario('cliente@example.com')
        self.outro = criar_usuario('outro@example.com')
        self.endereco = criar_endereco(self.usuario)
        self.produto = self.criar_produto('PED-0001', preco='100.00', estoque=10)
        self.outro_produto = self.criar_produto('PED-0002', preco='49.90', estoque=5)
        autenticar(self.client, self.usuario)

    def encher_carrinho(self, usuario: Usuario | None = None) -> Carrinho:
        """Dois itens: 2 x 100,00 e 1 x 49,90."""
        carrinho = Carrinho.objects.do_usuario(usuario or self.usuario)
        carrinho.adicionar(self.produto, 2)
        carrinho.adicionar(self.outro_produto, 1)
        return carrinho

    def fechar(self, servico: str = ServicoFrete.ECONOMICO, endereco: Endereco | None = None, **extras):
        dados = {'endereco': (endereco or self.endereco).pk, 'servico': servico}
        dados.update(extras)
        return self.client.post(reverse('checkout'), dados, format='json')


class CheckoutTests(BasePedidoTests):
    """Conversão do carrinho em pedido."""

    def test_checkout_cria_pedido(self) -> None:
        self.encher_carrinho()

        resposta = self.fechar()

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resposta.data['numero'].startswith('PED-'))
        self.assertEqual(resposta.data['status'], StatusPedido.AGUARDANDO_PAGAMENTO)
        self.assertEqual(resposta.data['status_pagamento'], StatusPagamento.PENDENTE)
        self.assertEqual(Pedido.objects.count(), 1)

    def test_valores_sao_calculados_no_backend(self) -> None:
        self.encher_carrinho()

        resposta = self.fechar()

        # 2 x 100,00 + 1 x 49,90 = 249,90. Frete sudeste: 19,90 + 2,50 por item extra.
        self.assertEqual(Decimal(resposta.data['subtotal']), Decimal('249.90'))
        self.assertEqual(Decimal(resposta.data['frete']), Decimal('24.90'))
        self.assertEqual(Decimal(resposta.data['total']), Decimal('274.80'))

    def test_item_guarda_sku_nome_e_preco_do_momento(self) -> None:
        self.encher_carrinho()
        self.fechar()

        item = ItemPedido.objects.get(produto=self.produto)
        self.assertEqual(item.sku, 'PED-0001')
        self.assertEqual(item.nome, 'Produto PED-0001')
        self.assertEqual(item.preco_unitario, Decimal('100.00'))
        self.assertEqual(item.subtotal, Decimal('200.00'))

    def test_mudanca_no_produto_nao_altera_o_pedido(self) -> None:
        self.encher_carrinho()
        self.fechar()

        self.produto.nome = 'Outro nome'
        self.produto.sku = 'PED-9999'
        self.produto.preco = Decimal('1.00')
        self.produto.save(update_fields=('nome', 'sku', 'preco'))

        item = ItemPedido.objects.get(produto=self.produto)
        self.assertEqual(item.nome, 'Produto PED-0001')
        self.assertEqual(item.sku, 'PED-0001')
        self.assertEqual(item.preco_unitario, Decimal('100.00'))
        self.assertEqual(Pedido.objects.get().total, Decimal('274.80'))

    def test_endereco_e_congelado_no_pedido(self) -> None:
        self.encher_carrinho()
        self.fechar()

        self.endereco.logradouro = 'Rua Nova'
        self.endereco.numero = '999'
        self.endereco.save(update_fields=('logradouro', 'numero'))

        entrega = Pedido.objects.get().entrega
        self.assertEqual(entrega.logradouro, 'Praça da Sé')
        self.assertEqual(entrega.numero, '100')

    def test_endereco_apagado_nao_derruba_o_pedido(self) -> None:
        self.encher_carrinho()
        self.fechar()

        self.endereco.delete()

        pedido = Pedido.objects.get()
        self.assertIsNone(pedido.endereco_origem)
        self.assertEqual(pedido.entrega.cidade, 'São Paulo')

    def test_checkout_nao_mexe_no_estoque(self) -> None:
        # A baixa fica para quando o pagamento for integrado.
        self.encher_carrinho()

        self.fechar()

        self.produto.refresh_from_db()
        self.outro_produto.refresh_from_db()
        self.assertEqual(self.produto.estoque, 10)
        self.assertEqual(self.outro_produto.estoque, 5)

    def test_checkout_esvazia_o_carrinho(self) -> None:
        carrinho = self.encher_carrinho()

        self.fechar()

        self.assertEqual(carrinho.itens.count(), 0)

    def test_produto_inativo_recusa_o_pedido(self) -> None:
        carrinho = self.encher_carrinho()
        Produto.objects.filter(pk=self.produto.pk).update(ativo=False)

        resposta = self.fechar()

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Pedido.objects.count(), 0)
        self.assertEqual(carrinho.itens.count(), 2)

    def test_carrinho_vazio_recusa_o_pedido(self) -> None:
        resposta = self.fechar()

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Pedido.objects.count(), 0)

    def test_checkout_repetido_nao_gera_segundo_pedido(self) -> None:
        self.encher_carrinho()
        self.fechar()

        resposta = self.fechar()

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Pedido.objects.count(), 1)

    def test_preco_novo_do_produto_vale_no_checkout(self) -> None:
        self.encher_carrinho()
        Produto.objects.filter(pk=self.produto.pk).update(preco=Decimal('150.00'))

        resposta = self.fechar()

        self.assertEqual(Decimal(resposta.data['subtotal']), Decimal('349.90'))

    def test_falha_no_meio_da_transacao_nao_deixa_rastro(self) -> None:
        carrinho = self.encher_carrinho()

        with patch('pedidos.models.ItemPedido.objects.bulk_create', side_effect=RuntimeError('falhou')):
            with self.assertRaises(RuntimeError):
                Pedido.objects.fechar_carrinho(
                    usuario=self.usuario, endereco=self.endereco, servico=ServicoFrete.ECONOMICO
                )

        self.assertEqual(Pedido.objects.count(), 0)
        self.assertEqual(carrinho.itens.count(), 2)

    def test_servico_de_frete_invalido(self) -> None:
        self.encher_carrinho()

        resposta = self.fechar(servico='aviao')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('servico', resposta.data)
        self.assertEqual(Pedido.objects.count(), 0)

    def test_endereco_de_outra_conta_e_recusado(self) -> None:
        self.encher_carrinho()
        endereco_do_outro = criar_endereco(self.outro)

        resposta = self.fechar(endereco=endereco_do_outro)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('endereco', resposta.data)
        self.assertEqual(Pedido.objects.count(), 0)

    def test_endereco_inexistente(self) -> None:
        self.encher_carrinho()

        resposta = self.client.post(
            reverse('checkout'), {'endereco': 999999, 'servico': ServicoFrete.ECONOMICO}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_checkout_sem_autenticacao(self) -> None:
        resposta = APIClient().post(reverse('checkout'), {}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)


class SegurancaCheckoutTests(BasePedidoTests):
    """O que o cliente tenta mandar no payload e o backend ignora."""

    def test_valores_enviados_pelo_cliente_sao_ignorados(self) -> None:
        self.encher_carrinho()

        resposta = self.fechar(
            subtotal='1.00', total='1.00', frete='0.01', preco='0.01', desconto='500.00'
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        pedido = Pedido.objects.get()
        self.assertEqual(pedido.subtotal, Decimal('249.90'))
        self.assertEqual(pedido.frete, Decimal('24.90'))
        self.assertEqual(pedido.total, Decimal('274.80'))

    def test_status_e_numero_enviados_sao_ignorados(self) -> None:
        self.encher_carrinho()

        resposta = self.fechar(
            status=StatusPedido.PAGO,
            status_pagamento=StatusPagamento.PAGO,
            numero='PED-FALSO',
            pago_em='2026-01-01T00:00:00Z',
        )

        pedido = Pedido.objects.get()
        self.assertEqual(pedido.status, StatusPedido.AGUARDANDO_PAGAMENTO)
        self.assertEqual(pedido.status_pagamento, StatusPagamento.PENDENTE)
        self.assertNotEqual(pedido.numero, 'PED-FALSO')
        self.assertIsNone(pedido.pago_em)

    def test_dono_do_pedido_vem_do_token(self) -> None:
        self.encher_carrinho()

        self.fechar(usuario=self.outro.pk)

        self.assertEqual(Pedido.objects.get().usuario, self.usuario)

    def test_checkout_nao_altera_preco_nem_estoque_pelo_payload(self) -> None:
        self.encher_carrinho()

        self.fechar(estoque=999, preco='1.00')

        self.produto.refresh_from_db()
        self.assertEqual(self.produto.preco, Decimal('100.00'))
        self.assertEqual(self.produto.estoque, 10)

    def test_item_de_pedido_nao_duplica_produto(self) -> None:
        self.encher_carrinho()
        self.fechar()
        pedido = Pedido.objects.get()

        with self.assertRaises(IntegrityError), transaction.atomic():
            ItemPedido.objects.create(
                pedido=pedido,
                produto=self.produto,
                sku='X',
                nome='X',
                preco_unitario=Decimal('1.00'),
                quantidade=1,
            )


class PedidoModeloTests(BasePedidoTests):
    """Número, valores e máquina de status."""

    def criar_pedido(self) -> Pedido:
        self.encher_carrinho()
        return Pedido.objects.fechar_carrinho(
            usuario=self.usuario, endereco=self.endereco, servico=ServicoFrete.ECONOMICO
        )

    def test_numero_e_unico_por_pedido(self) -> None:
        primeiro = self.criar_pedido()
        self.encher_carrinho()
        segundo = Pedido.objects.fechar_carrinho(
            usuario=self.usuario, endereco=self.endereco, servico=ServicoFrete.EXPRESSO
        )

        self.assertNotEqual(primeiro.numero, segundo.numero)

    def test_banco_recusa_numero_repetido(self) -> None:
        pedido = self.criar_pedido()

        with self.assertRaises(IntegrityError), transaction.atomic():
            Pedido.objects.create(
                usuario=self.outro,
                numero=pedido.numero,
                servico_frete=ServicoFrete.ECONOMICO,
                prazo_frete_em_dias=4,
                frete=Decimal('19.90'),
                subtotal=Decimal('10.00'),
                total=Decimal('29.90'),
            )

    def test_total_fecha_com_subtotal_mais_frete(self) -> None:
        pedido = self.criar_pedido()

        self.assertEqual(pedido.total, pedido.subtotal + pedido.frete)

    def test_banco_recusa_pedido_sem_valor(self) -> None:
        with self.assertRaises(IntegrityError), transaction.atomic():
            Pedido.objects.create(
                usuario=self.usuario,
                servico_frete=ServicoFrete.ECONOMICO,
                prazo_frete_em_dias=4,
                frete=Decimal('19.90'),
                subtotal=Decimal('0.00'),
                total=Decimal('19.90'),
            )

    def test_transicao_permitida(self) -> None:
        pedido = self.criar_pedido()

        pedido.alterar_status(StatusPedido.PAGO)
        pedido.alterar_status(StatusPedido.EM_PREPARACAO)

        self.assertEqual(pedido.status, StatusPedido.EM_PREPARACAO)

    def test_transicao_proibida(self) -> None:
        pedido = self.criar_pedido()

        with self.assertRaises(ValidationError):
            pedido.alterar_status(StatusPedido.ENVIADO)

        pedido.refresh_from_db()
        self.assertEqual(pedido.status, StatusPedido.AGUARDANDO_PAGAMENTO)

    def test_pedido_entregue_nao_muda_mais(self) -> None:
        pedido = self.criar_pedido()
        for destino in (StatusPedido.PAGO, StatusPedido.EM_PREPARACAO, StatusPedido.ENVIADO, StatusPedido.ENTREGUE):
            pedido.alterar_status(destino)

        with self.assertRaises(ValidationError):
            pedido.alterar_status(StatusPedido.CANCELADO)

    def test_pagamento_nasce_pendente(self) -> None:
        pedido = self.criar_pedido()

        self.assertEqual(pedido.status_pagamento, StatusPagamento.PENDENTE)
        self.assertIsNone(pedido.pago_em)
        self.assertEqual(pedido.pagamento_id_externo, '')

    def test_registrar_pagamento_marca_o_pedido(self) -> None:
        pedido = self.criar_pedido()

        pedido.registrar_pagamento('gateway-123')

        pedido.refresh_from_db()
        self.assertEqual(pedido.status_pagamento, StatusPagamento.PAGO)
        self.assertEqual(pedido.status, StatusPedido.PAGO)
        self.assertEqual(pedido.pagamento_id_externo, 'gateway-123')
        self.assertIsNotNone(pedido.pago_em)

    def test_registrar_pagamento_e_idempotente(self) -> None:
        pedido = self.criar_pedido()
        pedido.registrar_pagamento('gateway-123')
        primeiro_registro = pedido.pago_em

        pedido.registrar_pagamento('gateway-456')

        pedido.refresh_from_db()
        self.assertEqual(pedido.pagamento_id_externo, 'gateway-123')
        self.assertEqual(pedido.pago_em, primeiro_registro)


class PedidoApiTests(BasePedidoTests):
    """Listagem, detalhe e mudança de status."""

    def setUp(self) -> None:
        super().setUp()
        self.encher_carrinho()
        self.pedido = Pedido.objects.fechar_carrinho(
            usuario=self.usuario, endereco=self.endereco, servico=ServicoFrete.ECONOMICO
        )
        self.endereco_do_outro = criar_endereco(self.outro)
        carrinho_do_outro = Carrinho.objects.do_usuario(self.outro)
        carrinho_do_outro.adicionar(self.outro_produto, 1)
        self.pedido_do_outro = Pedido.objects.fechar_carrinho(
            usuario=self.outro, endereco=self.endereco_do_outro, servico=ServicoFrete.ECONOMICO
        )

    def test_cliente_lista_apenas_os_proprios_pedidos(self) -> None:
        resposta = self.client.get(reverse('pedido-list'))

        numeros = [item['numero'] for item in resposta.data['results']]
        self.assertEqual(numeros, [self.pedido.numero])

    def test_cliente_nao_acessa_pedido_de_outro(self) -> None:
        resposta = self.client.get(reverse('pedido-detail', args=[self.pedido_do_outro.numero]))

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_detalhe_do_proprio_pedido(self) -> None:
        resposta = self.client.get(reverse('pedido-detail', args=[self.pedido.numero]))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resposta.data['itens']), 2)
        self.assertEqual(resposta.data['entrega']['cidade'], 'São Paulo')

    def test_resposta_nao_traz_dados_internos(self) -> None:
        resposta = self.client.get(reverse('pedido-detail', args=[self.pedido.numero]))

        for campo in ('usuario', 'id', 'endereco_origem', 'pagamento_id_externo'):
            self.assertNotIn(campo, resposta.data)

    def test_pedido_nao_aceita_escrita_direta(self) -> None:
        resposta = self.client.patch(
            reverse('pedido-detail', args=[self.pedido.numero]),
            {'status': StatusPedido.PAGO, 'total': '1.00'},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.status, StatusPedido.AGUARDANDO_PAGAMENTO)

    def test_cliente_nao_altera_status(self) -> None:
        resposta = self.client.post(
            reverse('pedido-status', args=[self.pedido.numero]),
            {'status': StatusPedido.PAGO},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.status, StatusPedido.AGUARDANDO_PAGAMENTO)

    def test_admin_altera_status(self) -> None:
        autenticar(self.client, criar_usuario('admin@example.com', is_staff=True))

        resposta = self.client.post(
            reverse('pedido-status', args=[self.pedido.numero]),
            {'status': StatusPedido.PAGO},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.status, StatusPedido.PAGO)

    def test_admin_nao_faz_transicao_invalida(self) -> None:
        autenticar(self.client, criar_usuario('admin@example.com', is_staff=True))

        resposta = self.client.post(
            reverse('pedido-status', args=[self.pedido.numero]),
            {'status': StatusPedido.ENTREGUE},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.status, StatusPedido.AGUARDANDO_PAGAMENTO)

    def test_status_desconhecido(self) -> None:
        autenticar(self.client, criar_usuario('admin@example.com', is_staff=True))

        resposta = self.client.post(
            reverse('pedido-status', args=[self.pedido.numero]), {'status': 'entregue-ontem'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_enxerga_todos_os_pedidos(self) -> None:
        autenticar(self.client, criar_usuario('admin@example.com', is_staff=True))

        resposta = self.client.get(reverse('pedido-list'))

        self.assertEqual(resposta.data['count'], 2)

    def test_listagem_sem_autenticacao(self) -> None:
        resposta = APIClient().get(reverse('pedido-list'))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)


class FreteTests(BasePedidoTests):
    """Cotação e uso do frete."""

    def test_cotacao_devolve_as_opcoes(self) -> None:
        self.encher_carrinho()

        resposta = self.client.post(
            reverse('frete-cotacao'), {'endereco': self.endereco.pk}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        servicos = [opcao['servico'] for opcao in resposta.data]
        self.assertEqual(servicos, [ServicoFrete.ECONOMICO, ServicoFrete.EXPRESSO])
        self.assertEqual(Decimal(resposta.data[0]['preco']), Decimal('24.90'))
        self.assertEqual(resposta.data[0]['prazo_em_dias'], 4)

    def test_cotacao_muda_com_a_regiao(self) -> None:
        self.encher_carrinho()
        norte = criar_endereco(self.usuario, uf='AM', cidade='Manaus')

        resposta = self.client.post(reverse('frete-cotacao'), {'endereco': norte.pk}, format='json')

        self.assertEqual(Decimal(resposta.data[0]['preco']), Decimal('44.90'))
        self.assertEqual(resposta.data[0]['prazo_em_dias'], 14)

    def test_cotacao_com_carrinho_vazio(self) -> None:
        resposta = self.client.post(
            reverse('frete-cotacao'), {'endereco': self.endereco.pk}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cotacao_com_endereco_de_outra_conta(self) -> None:
        self.encher_carrinho()
        endereco_do_outro = criar_endereco(self.outro)

        resposta = self.client.post(
            reverse('frete-cotacao'), {'endereco': endereco_do_outro.pk}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cotacao_sem_autenticacao(self) -> None:
        resposta = APIClient().post(reverse('frete-cotacao'), {}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_preco_do_frete_do_pedido_vem_da_cotacao(self) -> None:
        self.encher_carrinho()

        self.fechar(servico=ServicoFrete.EXPRESSO)

        pedido = Pedido.objects.get()
        self.assertEqual(pedido.frete, Decimal('44.82'))
        self.assertEqual(pedido.prazo_frete_em_dias, 2)

    def test_estado_sem_entrega(self) -> None:
        with self.assertRaises(ValidationError):
            cotar_servico(ServicoFrete.ECONOMICO, 'XX', 1)


class CepTests(BasePedidoTests):
    """Consulta de CEP, sempre com o provedor simulado."""

    def url(self, cep: str = '01001000') -> str:
        return reverse('cep', args=[cep])

    def test_consulta_com_sucesso(self) -> None:
        with patch('pedidos.cep._buscar', return_value=RESPOSTA_VIACEP):
            resposta = self.client.get(self.url())

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['cidade'], 'São Paulo')
        self.assertEqual(resposta.data['uf'], 'SP')
        self.assertEqual(resposta.data['cep'], '01001000')

    def test_cep_fora_do_formato(self) -> None:
        resposta = self.client.get(self.url('123'))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cep', resposta.data)

    def test_cep_inexistente(self) -> None:
        with patch('pedidos.cep._buscar', return_value={'erro': 'true'}):
            resposta = self.client.get(self.url('99999999'))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_provedor_fora_do_ar(self) -> None:
        with patch('pedidos.cep._buscar', side_effect=ConsultaIndisponivel):
            resposta = self.client.get(self.url())

        self.assertEqual(resposta.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_timeout_do_provedor(self) -> None:
        with patch('pedidos.cep.urlopen', side_effect=URLError('timeout')):
            with self.assertRaises(ConsultaIndisponivel):
                consultar('01001000')

    def test_resposta_do_provedor_sem_os_campos(self) -> None:
        with patch('pedidos.cep._buscar', return_value={'cep': '01001-000'}):
            resposta = self.client.get(self.url())

        self.assertEqual(resposta.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_erro_nao_expoe_o_provedor(self) -> None:
        with patch('pedidos.cep._buscar', side_effect=ConsultaIndisponivel):
            resposta = self.client.get(self.url())

        self.assertNotIn('viacep', str(resposta.data).lower())

    def test_cep_invalido_no_modulo(self) -> None:
        with self.assertRaises(CepInvalido):
            consultar('abc')

    def test_consulta_sem_autenticacao(self) -> None:
        resposta = APIClient().get(self.url())

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)


class EmailDePedidoTests(BasePedidoTests):
    """Confirmação de pedido."""

    def test_confirmacao_e_enviada_apos_o_pedido(self) -> None:
        self.encher_carrinho()

        with self.captureOnCommitCallbacks(execute=True):
            resposta = self.fechar()

        self.assertEqual(len(mail.outbox), 1)
        mensagem = mail.outbox[0]
        self.assertIn(resposta.data['numero'], mensagem.subject)
        self.assertIn('274.80', mensagem.body)
        self.assertIn('Praça da Sé', mensagem.body)
        self.assertEqual(mensagem.to, [self.usuario.email])

    def test_falha_no_envio_nao_desfaz_o_pedido(self) -> None:
        self.encher_carrinho()

        with patch('painel.emails.send_mail', side_effect=OSError('smtp fora do ar')):
            with self.captureOnCommitCallbacks(execute=True):
                resposta = self.fechar()

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Pedido.objects.count(), 1)
        self.assertEqual(len(mail.outbox), 0)

    def test_checkout_recusado_nao_manda_email(self) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            self.fechar()

        self.assertEqual(len(mail.outbox), 0)
