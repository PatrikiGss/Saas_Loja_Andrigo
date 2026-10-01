"""Verificações que cruzam apps: o esquema OpenAPI e a política do admin."""

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import RequestFactory, SimpleTestCase, TestCase
from drf_spectacular.generators import SchemaGenerator

from carrinho.models import Carrinho
from painel.models import EventoAdministrativo
from pedidos.models import Pedido


class EsquemaTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.componentes = SchemaGenerator().get_schema(request=None, public=True)['components'][
            'schemas'
        ]

    def test_resposta_declara_todo_campo_como_presente(self) -> None:
        # `nome` é opcional para escrever, mas a resposta sempre o traz.
        perfil = self.componentes['Perfil']
        self.assertEqual(sorted(perfil['required']), sorted(perfil['properties']))

    def test_entrada_continua_com_campo_opcional(self) -> None:
        endereco = self.componentes['EnderecoRequest']
        self.assertNotIn('complemento', endereco['required'])
        self.assertIn('cep', endereco['required'])

    def test_enum_tem_nome_fixo(self) -> None:
        # O nome do enum vira o nome do tipo no frontend.
        for nome in ('StatusPedidoEnum', 'ServicoFreteEnum', 'CategoriaEnum', 'NivelEnum'):
            with self.subTest(nome=nome):
                self.assertIn('enum', self.componentes[nome])


class AdminSomenteConsultaTests(TestCase):
    """Carrinho, pedido e auditoria: o admin do Django mostra, e só."""

    def test_nem_superusuario_cria_altera_ou_apaga(self) -> None:
        requisicao = RequestFactory().get('/admin/')
        requisicao.user = get_user_model().objects.create_superuser(
            'raiz@example.com', 'raiz@example.com', 'Senha-Forte-2026'
        )

        for modelo in (Carrinho, Pedido, EventoAdministrativo):
            modelo_admin = admin.site._registry[modelo]
            inlines = [classe(modelo, admin.site) for classe in modelo_admin.inlines]
            for alvo in (modelo_admin, *inlines):
                with self.subTest(alvo=type(alvo).__name__):
                    self.assertFalse(alvo.has_add_permission(requisicao, None))
                    self.assertFalse(alvo.has_change_permission(requisicao, None))
                    self.assertFalse(alvo.has_delete_permission(requisicao, None))
