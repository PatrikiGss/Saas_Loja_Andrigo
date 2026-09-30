"""Esquema OpenAPI, que é de onde o frontend gera os tipos."""

from django.test import SimpleTestCase
from drf_spectacular.generators import SchemaGenerator


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
