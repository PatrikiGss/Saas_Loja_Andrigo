"""Testes do carrinho: itens, quantidades, segurança e integridade."""
from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from carrinho.models import QUANTIDADE_MAXIMA, Carrinho, ItemCarrinho
from loja.models import Categoria, Produto, Subtipo

Usuario = get_user_model()

SENHA = 'Senha-Forte-2026'


def criar_usuario(email: str, **campos) -> Usuario:
    return Usuario.objects.create_user(username=email, email=email, password=SENHA, **campos)


def autenticar(cliente: APIClient, usuario: Usuario) -> None:
    cliente.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(usuario)}')


class BaseCarrinhoTests(APITestCase):
    """Catálogo e contas usados pelos casos de teste."""

    @classmethod
    def setUpTestData(cls) -> None:
        cls.subtipo = Subtipo.objects.create(
            nome='Carrinho vape', slug='carrinho-vape', categoria=Categoria.VAPE
        )
        cls.produto = cls.criar_produto('CAR-0001', preco=Decimal('100.00'), estoque=10)
        cls.outro_produto = cls.criar_produto('CAR-0002', preco=Decimal('49.90'), estoque=5)

    @classmethod
    def criar_produto(
        cls,
        sku: str,
        preco: Decimal = Decimal('100.00'),
        estoque: int = 10,
        ativo: bool = True,
    ) -> Produto:
        return Produto.objects.create(
            subtipo=cls.subtipo,
            sku=sku,
            nome=f'Produto {sku}',
            marca='Marca',
            preco=preco,
            estoque=estoque,
            ativo=ativo,
        )

    def setUp(self) -> None:
        self.usuario = criar_usuario('cliente@example.com')
        self.outro = criar_usuario('outro@example.com')
        autenticar(self.client, self.usuario)

    def adicionar(self, produto: Produto | None = None, quantidade: int = 1, cliente: APIClient | None = None):
        cliente = cliente or self.client
        return cliente.post(
            reverse('carrinho-itens'),
            {'produto': str((produto or self.produto).id), 'quantidade': quantidade},
            format='json',
        )


class CarrinhoTests(BaseCarrinhoTests):
    """O carrinho em si."""

    def test_carrinho_e_criado_no_primeiro_acesso(self) -> None:
        resposta = self.client.get(reverse('carrinho'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertTrue(Carrinho.objects.filter(usuario=self.usuario).exists())

    def test_segundo_acesso_nao_cria_outro_carrinho(self) -> None:
        self.client.get(reverse('carrinho'))
        self.client.get(reverse('carrinho'))

        self.assertEqual(Carrinho.objects.filter(usuario=self.usuario).count(), 1)

    def test_carrinho_comeca_vazio(self) -> None:
        resposta = self.client.get(reverse('carrinho'))

        self.assertEqual(resposta.data['itens'], [])
        self.assertEqual(Decimal(resposta.data['total']), Decimal('0.00'))

    def test_banco_recusa_dois_carrinhos_para_a_mesma_conta(self) -> None:
        Carrinho.objects.create(usuario=self.usuario)

        with self.assertRaises(IntegrityError), transaction.atomic():
            Carrinho.objects.create(usuario=self.usuario)

    def test_total_soma_os_subtotais(self) -> None:
        self.adicionar(self.produto, 2)
        self.adicionar(self.outro_produto, 3)

        resposta = self.client.get(reverse('carrinho'))

        esperado = Decimal('100.00') * 2 + Decimal('49.90') * 3
        self.assertEqual(Decimal(resposta.data['total']), esperado)

    def test_subtotal_de_cada_item(self) -> None:
        self.adicionar(self.produto, 3)

        resposta = self.client.get(reverse('carrinho'))

        self.assertEqual(Decimal(resposta.data['itens'][0]['subtotal']), Decimal('300.00'))

    def test_cada_conta_tem_o_seu_carrinho(self) -> None:
        self.adicionar(self.produto, 2)
        autenticar(self.client, self.outro)

        resposta = self.client.get(reverse('carrinho'))

        self.assertEqual(resposta.data['itens'], [])
        self.assertEqual(Carrinho.objects.count(), 2)

    def test_leitura_nao_cresce_com_o_numero_de_itens(self) -> None:
        self.adicionar(self.produto, 1)
        with CaptureQueriesContext(connection) as com_um_item:
            self.client.get(reverse('carrinho'))

        self.adicionar(self.outro_produto, 1)
        with CaptureQueriesContext(connection) as com_dois_itens:
            self.client.get(reverse('carrinho'))

        self.assertEqual(len(com_um_item.captured_queries), len(com_dois_itens.captured_queries))

    def test_admin_enxerga_o_proprio_carrinho(self) -> None:
        self.adicionar(self.produto, 1)
        autenticar(self.client, criar_usuario('admin@example.com', is_staff=True))

        resposta = self.client.get(reverse('carrinho'))

        self.assertEqual(resposta.data['itens'], [])


class ItensTests(BaseCarrinhoTests):
    """Inclusão, alteração e remoção de itens."""

    def test_adicionar_produto(self) -> None:
        resposta = self.adicionar(self.produto, 2)

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data['quantidade'], 2)
        self.assertEqual(Decimal(resposta.data['subtotal']), Decimal('200.00'))
        self.assertEqual(resposta.data['produto']['sku'], 'CAR-0001')

    def test_adicionar_o_mesmo_produto_soma_a_quantidade(self) -> None:
        self.adicionar(self.produto, 2)

        resposta = self.adicionar(self.produto, 3)

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data['quantidade'], 5)
        self.assertEqual(ItemCarrinho.objects.filter(produto=self.produto).count(), 1)

    def test_soma_respeita_o_estoque(self) -> None:
        self.adicionar(self.produto, 4)

        resposta = self.adicionar(self.produto, 8)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('quantidade', resposta.data)
        self.assertEqual(ItemCarrinho.objects.get(produto=self.produto).quantidade, 4)

    def test_alterar_quantidade(self) -> None:
        item = ItemCarrinho.objects.get(pk=self.adicionar(self.produto, 2).data['id'])

        resposta = self.client.patch(
            reverse('carrinho-item', args=[item.pk]), {'quantidade': 8}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(resposta.data['subtotal']), Decimal('800.00'))
        item.refresh_from_db()
        self.assertEqual(item.quantidade, 8)

    def test_alterar_quantidade_acima_do_estoque(self) -> None:
        item = ItemCarrinho.objects.get(pk=self.adicionar(self.produto, 4).data['id'])

        resposta = self.client.patch(
            reverse('carrinho-item', args=[item.pk]), {'quantidade': 11}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        item.refresh_from_db()
        self.assertEqual(item.quantidade, 4)

    def test_alterar_quantidade_para_zero(self) -> None:
        item = ItemCarrinho.objects.get(pk=self.adicionar(self.produto, 4).data['id'])

        resposta = self.client.patch(
            reverse('carrinho-item', args=[item.pk]), {'quantidade': 0}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        item.refresh_from_db()
        self.assertEqual(item.quantidade, 4)

    def test_alterar_quantidade_negativa(self) -> None:
        item = ItemCarrinho.objects.get(pk=self.adicionar(self.produto, 4).data['id'])

        resposta = self.client.patch(
            reverse('carrinho-item', args=[item.pk]), {'quantidade': -3}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_alterar_quantidade_acima_do_maximo(self) -> None:
        item = ItemCarrinho.objects.get(pk=self.adicionar(self.produto, 1).data['id'])

        resposta = self.client.patch(
            reverse('carrinho-item', args=[item.pk]),
            {'quantidade': QUANTIDADE_MAXIMA + 1},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_remover_item(self) -> None:
        item = ItemCarrinho.objects.get(pk=self.adicionar(self.produto, 2).data['id'])

        resposta = self.client.delete(reverse('carrinho-item', args=[item.pk]))

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ItemCarrinho.objects.filter(pk=item.pk).exists())
        self.assertTrue(Produto.objects.filter(pk=self.produto.pk).exists())

    def test_limpar_carrinho(self) -> None:
        self.adicionar(self.produto, 2)
        self.adicionar(self.outro_produto, 1)

        resposta = self.client.delete(reverse('carrinho-itens'))

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(ItemCarrinho.objects.count(), 0)
        self.assertTrue(Carrinho.objects.filter(usuario=self.usuario).exists())

    def test_limpar_carrinho_vazio(self) -> None:
        resposta = self.client.delete(reverse('carrinho-itens'))

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)

    def test_quantidade_zero_na_inclusao(self) -> None:
        resposta = self.adicionar(self.produto, 0)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('quantidade', resposta.data)
        self.assertEqual(ItemCarrinho.objects.count(), 0)

    def test_quantidade_negativa_na_inclusao(self) -> None:
        resposta = self.adicionar(self.produto, -2)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quantidade_acima_do_estoque_na_inclusao(self) -> None:
        resposta = self.adicionar(self.produto, 11)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ItemCarrinho.objects.count(), 0)

    def test_quantidade_acima_do_maximo_na_inclusao(self) -> None:
        resposta = self.adicionar(self.produto, QUANTIDADE_MAXIMA + 1)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quantidade_decimal(self) -> None:
        resposta = self.client.post(
            reverse('carrinho-itens'),
            {'produto': str(self.produto.id), 'quantidade': '2.5'},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quantidade_nao_numerica(self) -> None:
        resposta = self.client.post(
            reverse('carrinho-itens'),
            {'produto': str(self.produto.id), 'quantidade': 'muitos'},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_produto_inexistente(self) -> None:
        resposta = self.client.post(
            reverse('carrinho-itens'),
            {'produto': '6b1a6f0e-0000-4000-8000-000000000000', 'quantidade': 1},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('produto', resposta.data)

    def test_produto_inativo(self) -> None:
        inativo = self.criar_produto('CAR-0003', ativo=False)

        resposta = self.adicionar(inativo, 1)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('produto', resposta.data)
        self.assertEqual(ItemCarrinho.objects.count(), 0)

    def test_produto_sem_estoque(self) -> None:
        esgotado = self.criar_produto('CAR-0004', estoque=0)

        resposta = self.adicionar(esgotado, 1)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ItemCarrinho.objects.count(), 0)

    def test_payload_vazio(self) -> None:
        resposta = self.client.post(reverse('carrinho-itens'), {}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('produto', resposta.data)
        self.assertIn('quantidade', resposta.data)

    def test_item_inexistente(self) -> None:
        url = reverse('carrinho-item', args=[999999])

        self.assertEqual(
            self.client.patch(url, {'quantidade': 1}, format='json').status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(self.client.delete(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_produto_desativado_depois_aparece_indisponivel(self) -> None:
        self.adicionar(self.produto, 2)
        self.produto.ativo = False
        self.produto.save(update_fields=('ativo',))

        resposta = self.client.get(reverse('carrinho'))

        self.assertEqual(len(resposta.data['itens']), 1)
        self.assertFalse(resposta.data['itens'][0]['produto']['disponivel'])

    def test_produto_sem_estoque_depois_aparece_indisponivel(self) -> None:
        self.adicionar(self.produto, 2)
        self.produto.estoque = 0
        self.produto.save(update_fields=('estoque',))

        resposta = self.client.get(reverse('carrinho'))

        self.assertFalse(resposta.data['itens'][0]['produto']['disponivel'])


class SegurancaCarrinhoTests(BaseCarrinhoTests):
    """Autenticação, isolamento entre contas e campos protegidos."""

    def item_do_outro(self, quantidade: int = 2) -> ItemCarrinho:
        """Item pertencente à outra conta."""
        return Carrinho.objects.do_usuario(self.outro).adicionar(self.produto, quantidade)

    def test_endpoints_exigem_autenticacao(self) -> None:
        anonimo = APIClient()
        item = self.item_do_outro()

        self.assertEqual(anonimo.get(reverse('carrinho')).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            anonimo.post(reverse('carrinho-itens'), {'produto': str(self.produto.id), 'quantidade': 1},
                         format='json').status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            anonimo.delete(reverse('carrinho-itens')).status_code, status.HTTP_401_UNAUTHORIZED
        )
        self.assertEqual(
            anonimo.patch(reverse('carrinho-item', args=[item.pk]), {'quantidade': 1},
                          format='json').status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_usuario_nao_ve_itens_de_outra_conta(self) -> None:
        self.item_do_outro()

        resposta = self.client.get(reverse('carrinho'))

        self.assertEqual(resposta.data['itens'], [])

    def test_usuario_nao_le_item_de_outra_conta(self) -> None:
        item = self.item_do_outro()

        resposta = self.client.get(reverse('carrinho-item', args=[item.pk]))

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_usuario_nao_altera_item_de_outra_conta(self) -> None:
        item = self.item_do_outro()

        resposta = self.client.patch(
            reverse('carrinho-item', args=[item.pk]), {'quantidade': 9}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
        item.refresh_from_db()
        self.assertEqual(item.quantidade, 2)

    def test_usuario_nao_remove_item_de_outra_conta(self) -> None:
        item = self.item_do_outro()

        resposta = self.client.delete(reverse('carrinho-item', args=[item.pk]))

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(ItemCarrinho.objects.filter(pk=item.pk).exists())

    def test_limpar_nao_afeta_carrinho_de_outra_conta(self) -> None:
        item = self.item_do_outro()

        self.client.delete(reverse('carrinho-itens'))

        self.assertTrue(ItemCarrinho.objects.filter(pk=item.pk).exists())

    def test_payload_nao_define_o_dono(self) -> None:
        carrinho_do_outro = Carrinho.objects.do_usuario(self.outro)

        resposta = self.client.post(
            reverse('carrinho-itens'),
            {'produto': str(self.produto.id), 'quantidade': 1,
             'usuario': self.outro.pk, 'carrinho': carrinho_do_outro.pk},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        item = ItemCarrinho.objects.get(pk=resposta.data['id'])
        self.assertEqual(item.carrinho.usuario, self.usuario)
        self.assertEqual(carrinho_do_outro.itens.count(), 0)

    def test_payload_nao_altera_o_preco(self) -> None:
        resposta = self.client.post(
            reverse('carrinho-itens'),
            {'produto': str(self.produto.id), 'quantidade': 1, 'preco': '0.01', 'subtotal': '0.01',
             'total': '0.01'},
            format='json',
        )

        self.assertEqual(Decimal(resposta.data['subtotal']), Decimal('100.00'))
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.preco, Decimal('100.00'))

    def test_payload_nao_altera_o_estoque(self) -> None:
        self.client.post(
            reverse('carrinho-itens'),
            {'produto': str(self.produto.id), 'quantidade': 1, 'estoque': 999},
            format='json',
        )

        self.produto.refresh_from_db()
        self.assertEqual(self.produto.estoque, 10)

    def test_patch_nao_troca_o_produto_do_item(self) -> None:
        item = ItemCarrinho.objects.get(pk=self.adicionar(self.produto, 1).data['id'])

        resposta = self.client.patch(
            reverse('carrinho-item', args=[item.pk]),
            {'quantidade': 2, 'produto': str(self.outro_produto.id), 'carrinho': 999,
             'id': 999, 'is_staff': True},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        item.refresh_from_db()
        self.assertEqual(item.produto, self.produto)
        self.assertEqual(item.quantidade, 2)
        self.usuario.refresh_from_db()
        self.assertFalse(self.usuario.is_staff)

    def test_resposta_nao_expoe_estoque_nem_status_interno(self) -> None:
        self.adicionar(self.produto, 1)

        resposta = self.client.get(reverse('carrinho'))

        produto = resposta.data['itens'][0]['produto']
        for campo in ('estoque', 'ativo', 'criado_em', 'atualizado_em'):
            self.assertNotIn(campo, produto)
        self.assertIn('disponivel', produto)


class IntegridadeCarrinhoTests(BaseCarrinhoTests):
    """Garantias no banco e integração com a loja."""

    def test_banco_recusa_produto_repetido_no_mesmo_carrinho(self) -> None:
        carrinho = Carrinho.objects.do_usuario(self.usuario)
        ItemCarrinho.objects.create(carrinho=carrinho, produto=self.produto, quantidade=1)

        with self.assertRaises(IntegrityError), transaction.atomic():
            ItemCarrinho.objects.create(carrinho=carrinho, produto=self.produto, quantidade=1)

    def test_banco_recusa_quantidade_zero(self) -> None:
        carrinho = Carrinho.objects.do_usuario(self.usuario)

        with self.assertRaises(IntegrityError), transaction.atomic():
            ItemCarrinho.objects.create(carrinho=carrinho, produto=self.produto, quantidade=0)

    def test_banco_recusa_quantidade_acima_do_maximo(self) -> None:
        carrinho = Carrinho.objects.do_usuario(self.usuario)

        with self.assertRaises(IntegrityError), transaction.atomic():
            ItemCarrinho.objects.create(
                carrinho=carrinho, produto=self.produto, quantidade=QUANTIDADE_MAXIMA + 1
            )

    def test_produto_no_carrinho_nao_pode_ser_excluido(self) -> None:
        self.adicionar(self.produto, 1)
        administrador = criar_usuario('admin@example.com', is_staff=True)
        cliente_admin = APIClient()
        autenticar(cliente_admin, administrador)

        resposta = cliente_admin.delete(reverse('produto-detail', args=[self.produto.id]))

        self.assertEqual(resposta.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(Produto.objects.filter(pk=self.produto.pk).exists())

    def test_apagar_a_conta_apaga_o_carrinho(self) -> None:
        self.adicionar(self.produto, 1)

        self.usuario.delete()

        self.assertEqual(Carrinho.objects.count(), 0)
        self.assertEqual(ItemCarrinho.objects.count(), 0)

    def test_inclusoes_seguidas_mantem_uma_linha(self) -> None:
        for _ in range(3):
            self.adicionar(self.produto, 1)

        self.assertEqual(ItemCarrinho.objects.filter(produto=self.produto).count(), 1)
        self.assertEqual(ItemCarrinho.objects.get(produto=self.produto).quantidade, 3)
