"""Testes do catálogo: modelo, serializers, permissões e endpoints."""
from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from loja.models import Categoria, Produto, Subtipo

Usuario = get_user_model()

SENHA = 'senha-de-teste-123'

#: Especificações válidas por categoria, como o modelo as espera.
ESPECIFICACOES_VALIDAS: dict[str, dict[str, object]] = {
    Categoria.POD_DESCARTAVEL: {'puffs': 6000, 'nicotina_mg_ml': Decimal('50.0')},
    Categoria.ESSENCIA: {'volume_ml': Decimal('30.00'), 'nicotina_mg_ml': Decimal('3.0')},
}

#: As mesmas especificações em tipos aceitos por JSON.
ESPECIFICACOES_JSON: dict[str, dict[str, object]] = {
    Categoria.POD_DESCARTAVEL: {'puffs': 6000, 'nicotina_mg_ml': '50.0'},
    Categoria.ESSENCIA: {'volume_ml': '30.00', 'nicotina_mg_ml': '3.0'},
}


def criar_produto(subtipo: Subtipo, **campos) -> Produto:
    """Cria um produto coerente com a categoria do subtipo."""
    dados: dict[str, object] = {
        'sku': f'SKU-{uuid.uuid4().hex[:8].upper()}',
        'nome': 'Produto de teste',
        'marca': 'Marca',
        'preco': Decimal('99.90'),
        'estoque': 10,
    }
    dados.update(ESPECIFICACOES_VALIDAS.get(subtipo.categoria, {}))
    dados.update(campos)
    return Produto.objects.create(subtipo=subtipo, **dados)


def payload_produto(subtipo: Subtipo, **campos) -> dict:
    """Monta o corpo de uma requisição de cadastro."""
    dados: dict[str, object] = {
        'sku': f'API-{uuid.uuid4().hex[:8].upper()}',
        'nome': 'Produto via API',
        'marca': 'Marca',
        'preco': '49.90',
        'subtipo': subtipo.slug,
    }
    dados.update(ESPECIFICACOES_JSON.get(subtipo.categoria, {}))
    dados.update(campos)
    return dados


class BaseCatalogoTests(APITestCase):
    """Subtipos e usuários compartilhados pelos casos de teste."""

    @classmethod
    def setUpTestData(cls) -> None:
        cls.descartavel = Subtipo.objects.create(
            nome='Teste descartável', slug='teste-descartavel', categoria=Categoria.POD_DESCARTAVEL
        )
        cls.essencia = Subtipo.objects.create(
            nome='Teste essência', slug='teste-essencia', categoria=Categoria.ESSENCIA
        )
        cls.vape = Subtipo.objects.create(
            nome='Teste vape', slug='teste-vape', categoria=Categoria.VAPE
        )
        cls.cliente = Usuario.objects.create_user('cliente', password=SENHA)
        cls.equipe = Usuario.objects.create_user('equipe', password=SENHA, is_staff=True)


class ProdutoModelTests(BaseCatalogoTests):
    """Regras de domínio e integridade no banco."""

    def test_especificacoes_da_categoria_sao_obrigatorias(self) -> None:
        produto = Produto(
            subtipo=self.essencia, sku='ESS-0001', nome='Menta', marca='Marca', preco=Decimal('30.00')
        )

        with self.assertRaises(ValidationError) as contexto:
            produto.full_clean()

        self.assertIn('volume_ml', contexto.exception.message_dict)
        self.assertIn('nicotina_mg_ml', contexto.exception.message_dict)

    def test_especificacao_de_outra_categoria_e_recusada(self) -> None:
        produto = Produto(
            subtipo=self.vape, sku='VAP-0001', nome='Kit', marca='Marca', preco=Decimal('300.00'), puffs=5000
        )

        with self.assertRaises(ValidationError) as contexto:
            produto.full_clean()

        self.assertIn('puffs', contexto.exception.message_dict)

    def test_essencia_sem_nicotina_e_valida(self) -> None:
        produto = Produto(
            subtipo=self.essencia,
            sku='ESS-0002',
            nome='Frutas',
            marca='Marca',
            preco=Decimal('30.00'),
            volume_ml=Decimal('30.00'),
            nicotina_mg_ml=Decimal('0.0'),
        )

        produto.full_clean()

    def test_nicotina_acima_do_limite_e_recusada(self) -> None:
        produto = Produto(
            subtipo=self.essencia,
            sku='ESS-0003',
            nome='Forte',
            marca='Marca',
            preco=Decimal('30.00'),
            volume_ml=Decimal('30.00'),
            nicotina_mg_ml=Decimal('99.0'),
        )

        with self.assertRaises(ValidationError) as contexto:
            produto.full_clean()

        self.assertIn('nicotina_mg_ml', contexto.exception.message_dict)

    def test_sku_exige_formato(self) -> None:
        produto = Produto(
            subtipo=self.vape, sku='sku minusculo', nome='Kit', marca='Marca', preco=Decimal('10.00')
        )

        with self.assertRaises(ValidationError) as contexto:
            produto.full_clean()

        self.assertIn('sku', contexto.exception.message_dict)

    def test_sku_e_unico(self) -> None:
        criar_produto(self.vape, sku='VAP-9999')

        with self.assertRaises(IntegrityError), transaction.atomic():
            criar_produto(self.vape, sku='VAP-9999')

    def test_subtipo_nao_repete_nome_na_categoria(self) -> None:
        with self.assertRaises(IntegrityError), transaction.atomic():
            Subtipo.objects.create(
                nome='Teste vape', slug='outro-slug', categoria=Categoria.VAPE
            )

    def test_banco_recusa_preco_zerado(self) -> None:
        with self.assertRaises(IntegrityError), transaction.atomic():
            criar_produto(self.vape, preco=Decimal('0.00'))

    def test_banco_recusa_estoque_negativo(self) -> None:
        with self.assertRaises(IntegrityError), transaction.atomic():
            criar_produto(self.vape, estoque=-1)

    def test_subtipo_em_uso_nao_pode_ser_apagado(self) -> None:
        criar_produto(self.vape)

        with self.assertRaises(ProtectedError):
            self.vape.delete()

    def test_ajustar_estoque_repoe_e_da_baixa(self) -> None:
        produto = criar_produto(self.vape, estoque=10)

        self.assertEqual(produto.ajustar_estoque(5), 15)
        self.assertEqual(produto.ajustar_estoque(-7), 8)
        produto.refresh_from_db()
        self.assertEqual(produto.estoque, 8)

    def test_ajustar_estoque_nao_deixa_estoque_negativo(self) -> None:
        produto = criar_produto(self.vape, estoque=3)

        with self.assertRaises(ValidationError):
            produto.ajustar_estoque(-4)

        produto.refresh_from_db()
        self.assertEqual(produto.estoque, 3)

    def test_em_estoque_reflete_a_quantidade(self) -> None:
        self.assertTrue(criar_produto(self.vape, estoque=1).em_estoque)
        self.assertFalse(criar_produto(self.vape, estoque=0).em_estoque)


class CatalogoPublicoTests(BaseCatalogoTests):
    """Leitura do catálogo por quem não está autenticado."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.ativo = criar_produto(cls.vape, nome='Kit visível', preco=Decimal('250.00'))
        cls.inativo = criar_produto(cls.vape, nome='Kit oculto', ativo=False)
        cls.pod = criar_produto(cls.descartavel, nome='Pod de morango', marca='Elfbar', preco=Decimal('80.00'))

    def test_lista_apenas_produtos_ativos(self) -> None:
        resposta = self.client.get(reverse('produto-list'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        nomes = [item['nome'] for item in resposta.data['results']]
        self.assertIn('Kit visível', nomes)
        self.assertNotIn('Kit oculto', nomes)

    def test_resposta_e_paginada(self) -> None:
        resposta = self.client.get(reverse('produto-list'))

        self.assertIn('count', resposta.data)
        self.assertIn('results', resposta.data)

    def test_catalogo_nao_expoe_campos_internos(self) -> None:
        resposta = self.client.get(reverse('produto-detail', args=[self.ativo.id]))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        for campo in ('estoque', 'ativo', 'criado_em', 'atualizado_em'):
            self.assertNotIn(campo, resposta.data)
        self.assertIn('em_estoque', resposta.data)

    def test_detalhe_traz_categoria_e_subtipo(self) -> None:
        resposta = self.client.get(reverse('produto-detail', args=[self.pod.id]))

        self.assertEqual(resposta.data['categoria'], Categoria.POD_DESCARTAVEL)
        self.assertEqual(resposta.data['subtipo'], self.descartavel.slug)
        self.assertEqual(resposta.data['puffs'], 6000)

    def test_produto_inativo_responde_404(self) -> None:
        resposta = self.client.get(reverse('produto-detail', args=[self.inativo.id]))

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_id_inexistente_responde_404(self) -> None:
        resposta = self.client.get(reverse('produto-detail', args=[uuid.uuid4()]))

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_id_malformado_responde_404(self) -> None:
        resposta = self.client.get('/api/produtos/1/')

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_filtra_por_categoria(self) -> None:
        resposta = self.client.get(reverse('produto-list'), {'categoria': Categoria.POD_DESCARTAVEL})

        nomes = [item['nome'] for item in resposta.data['results']]
        self.assertEqual(nomes, ['Pod de morango'])

    def test_categoria_invalida_responde_400(self) -> None:
        resposta = self.client.get(reverse('produto-list'), {'categoria': 'cigarro'})

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('categoria', resposta.data)

    def test_filtra_por_subtipo(self) -> None:
        resposta = self.client.get(reverse('produto-list'), {'subtipo': self.descartavel.slug})

        self.assertEqual(resposta.data['count'], 1)

    def test_busca_por_marca(self) -> None:
        resposta = self.client.get(reverse('produto-list'), {'search': 'elfbar'})

        nomes = [item['nome'] for item in resposta.data['results']]
        self.assertEqual(nomes, ['Pod de morango'])

    def test_busca_com_caractere_de_sql_nao_quebra(self) -> None:
        resposta = self.client.get(reverse('produto-list'), {'search': "'; DROP TABLE loja_produto; --"})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['count'], 0)
        self.assertTrue(Produto.objects.exists())

    def test_ordena_por_preco(self) -> None:
        resposta = self.client.get(reverse('produto-list'), {'ordering': 'preco'})

        precos = [Decimal(item['preco']) for item in resposta.data['results']]
        self.assertEqual(precos, sorted(precos))

    def test_ordenacao_por_campo_interno_e_ignorada(self) -> None:
        resposta = self.client.get(reverse('produto-list'), {'ordering': 'estoque'})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        nomes = [item['nome'] for item in resposta.data['results']]
        self.assertEqual(nomes, sorted(nomes))

    def test_subtipos_sao_listados(self) -> None:
        resposta = self.client.get(reverse('subtipo-list'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        slugs = [item['slug'] for item in resposta.data['results']]
        self.assertIn(self.vape.slug, slugs)

    def test_subtipos_nao_aceitam_escrita(self) -> None:
        resposta = self.client.post(reverse('subtipo-list'), {'nome': 'Novo', 'slug': 'novo'}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class EscritaProdutoTests(BaseCatalogoTests):
    """Cadastro, alteração e exclusão de produtos."""

    def test_anonimo_nao_cadastra(self) -> None:
        resposta = self.client.post(reverse('produto-list'), payload_produto(self.vape), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(Produto.objects.exists())

    def test_cliente_autenticado_nao_cadastra(self) -> None:
        self.client.force_authenticate(self.cliente)

        resposta = self.client.post(reverse('produto-list'), payload_produto(self.vape), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Produto.objects.exists())

    def test_equipe_cadastra(self) -> None:
        self.client.force_authenticate(self.equipe)
        dados = payload_produto(self.essencia, sku='ESS-1000', nome='Uva gelada')

        resposta = self.client.post(reverse('produto-list'), dados, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        produto = Produto.objects.get(sku='ESS-1000')
        self.assertEqual(produto.nome, 'Uva gelada')
        self.assertEqual(produto.subtipo, self.essencia)
        self.assertEqual(produto.preco, Decimal('49.90'))

    def test_cadastro_ignora_estoque_enviado_pelo_cliente(self) -> None:
        self.client.force_authenticate(self.equipe)
        dados = payload_produto(self.vape, sku='VAP-1000', estoque=999)

        resposta = self.client.post(reverse('produto-list'), dados, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Produto.objects.get(sku='VAP-1000').estoque, 0)

    def test_cadastro_ignora_id_enviado_pelo_cliente(self) -> None:
        self.client.force_authenticate(self.equipe)
        id_escolhido = uuid.uuid4()
        dados = payload_produto(self.vape, sku='VAP-1001', id=str(id_escolhido))

        resposta = self.client.post(reverse('produto-list'), dados, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(Produto.objects.get(sku='VAP-1001').id, id_escolhido)

    def test_cadastro_recusa_preco_zerado(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(
            reverse('produto-list'), payload_produto(self.vape, preco='0.00'), format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('preco', resposta.data)

    def test_cadastro_recusa_preco_negativo(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(
            reverse('produto-list'), payload_produto(self.vape, preco='-10.00'), format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cadastro_recusa_sku_fora_do_formato(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(
            reverse('produto-list'), payload_produto(self.vape, sku='ab'), format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('sku', resposta.data)

    def test_cadastro_recusa_sku_duplicado(self) -> None:
        criar_produto(self.vape, sku='VAP-2000')
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(
            reverse('produto-list'), payload_produto(self.vape, sku='VAP-2000'), format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('sku', resposta.data)

    def test_cadastro_exige_campos_obrigatorios(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(reverse('produto-list'), {}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        for campo in ('sku', 'nome', 'marca', 'preco', 'subtipo'):
            self.assertIn(campo, resposta.data)

    def test_cadastro_exige_especificacao_da_categoria(self) -> None:
        self.client.force_authenticate(self.equipe)
        dados = payload_produto(self.essencia)
        dados.pop('volume_ml')

        resposta = self.client.post(reverse('produto-list'), dados, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('volume_ml', resposta.data)

    def test_cadastro_recusa_especificacao_de_outra_categoria(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(
            reverse('produto-list'), payload_produto(self.vape, puffs=5000), format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('puffs', resposta.data)

    def test_cadastro_recusa_subtipo_inexistente(self) -> None:
        self.client.force_authenticate(self.equipe)
        dados = payload_produto(self.vape)
        dados['subtipo'] = 'nao-existe'

        resposta = self.client.post(reverse('produto-list'), dados, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('subtipo', resposta.data)

    def test_cliente_nao_altera_preco(self) -> None:
        produto = criar_produto(self.vape, preco=Decimal('250.00'))
        self.client.force_authenticate(self.cliente)

        resposta = self.client.patch(
            reverse('produto-detail', args=[produto.id]), {'preco': '1.00'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        produto.refresh_from_db()
        self.assertEqual(produto.preco, Decimal('250.00'))

    def test_equipe_altera_preco(self) -> None:
        produto = criar_produto(self.vape, preco=Decimal('250.00'))
        self.client.force_authenticate(self.equipe)

        resposta = self.client.patch(
            reverse('produto-detail', args=[produto.id]), {'preco': '199.90'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        produto.refresh_from_db()
        self.assertEqual(produto.preco, Decimal('199.90'))

    def test_alteracao_nao_muda_estoque(self) -> None:
        produto = criar_produto(self.vape, estoque=7)
        self.client.force_authenticate(self.equipe)

        resposta = self.client.patch(
            reverse('produto-detail', args=[produto.id]), {'estoque': 500}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        produto.refresh_from_db()
        self.assertEqual(produto.estoque, 7)

    def test_alteracao_mantem_regras_da_categoria(self) -> None:
        produto = criar_produto(self.essencia)
        self.client.force_authenticate(self.equipe)

        resposta = self.client.patch(
            reverse('produto-detail', args=[produto.id]), {'volume_ml': None}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('volume_ml', resposta.data)

    def test_equipe_desativa_produto(self) -> None:
        produto = criar_produto(self.vape)
        self.client.force_authenticate(self.equipe)

        resposta = self.client.patch(
            reverse('produto-detail', args=[produto.id]), {'ativo': False}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        produto.refresh_from_db()
        self.assertFalse(produto.ativo)

    def test_equipe_ve_produto_inativo_com_campos_internos(self) -> None:
        produto = criar_produto(self.vape, ativo=False, estoque=4)
        self.client.force_authenticate(self.equipe)

        resposta = self.client.get(reverse('produto-detail', args=[produto.id]))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['estoque'], 4)
        self.assertFalse(resposta.data['ativo'])

    def test_cliente_nao_exclui(self) -> None:
        produto = criar_produto(self.vape)
        self.client.force_authenticate(self.cliente)

        resposta = self.client.delete(reverse('produto-detail', args=[produto.id]))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Produto.objects.filter(pk=produto.pk).exists())

    def test_equipe_exclui(self) -> None:
        produto = criar_produto(self.vape)
        self.client.force_authenticate(self.equipe)

        resposta = self.client.delete(reverse('produto-detail', args=[produto.id]))

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Produto.objects.filter(pk=produto.pk).exists())

    def test_produto_em_uso_responde_409(self) -> None:
        # O carrinho ainda não existe, então a recusa do banco é simulada. É o
        # que vai acontecer quando o item de carrinho apontar com PROTECT.
        produto = criar_produto(self.vape)
        self.client.force_authenticate(self.equipe)

        with patch.object(Produto, 'delete', side_effect=ProtectedError('em uso', {produto})):
            resposta = self.client.delete(reverse('produto-detail', args=[produto.id]))

        self.assertEqual(resposta.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(Produto.objects.filter(pk=produto.pk).exists())

    def test_json_malformado_responde_400(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(
            reverse('produto-list'), '{"nome":', content_type='application/json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)


class AjusteEstoqueTests(BaseCatalogoTests):
    """Endpoint dedicado ao estoque."""

    def setUp(self) -> None:
        self.produto = criar_produto(self.vape, estoque=10)
        self.url = reverse('produto-estoque', args=[self.produto.id])

    def test_equipe_repoe_estoque(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(self.url, {'delta': 5}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['estoque'], 15)
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.estoque, 15)

    def test_equipe_da_baixa_no_estoque(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(self.url, {'delta': -4}, format='json')

        self.assertEqual(resposta.data['estoque'], 6)

    def test_baixa_maior_que_o_estoque_responde_400(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(self.url, {'delta': -11}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.estoque, 10)

    def test_delta_zero_responde_400(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(self.url, {'delta': 0}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('delta', resposta.data)

    def test_delta_nao_numerico_responde_400(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(self.url, {'delta': 'muitos'}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delta_ausente_responde_400(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(self.url, {}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('delta', resposta.data)

    def test_cliente_nao_ajusta_estoque(self) -> None:
        self.client.force_authenticate(self.cliente)

        resposta = self.client.post(self.url, {'delta': 100}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.estoque, 10)

    def test_anonimo_nao_ajusta_estoque(self) -> None:
        resposta = self.client.post(self.url, {'delta': 100}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_produto_inexistente_responde_404(self) -> None:
        self.client.force_authenticate(self.equipe)

        resposta = self.client.post(
            reverse('produto-estoque', args=[uuid.uuid4()]), {'delta': 1}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)


class SubtipoInicialTests(APITestCase):
    """A carga inicial precisa cobrir todas as categorias."""

    def test_todas_as_categorias_tem_subtipo(self) -> None:
        categorias_cadastradas = set(Subtipo.objects.values_list('categoria', flat=True))

        self.assertEqual(categorias_cadastradas, set(Categoria.values))
