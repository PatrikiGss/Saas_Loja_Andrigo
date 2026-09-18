"""Testes de conta, autenticação, perfil e autorização."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from loja.models import Categoria, Produto, Subtipo
from painel.models import Endereco, Nivel, Perfil

Usuario = get_user_model()

SENHA = 'Senha-Forte-2026'


def criar_usuario(email: str = 'cliente@example.com', **campos) -> Usuario:
    """Cria uma conta comum, do mesmo jeito que o cadastro público cria."""
    return Usuario.objects.create_user(username=email, email=email, password=SENHA, **campos)


def criar_admin(email: str = 'admin@example.com') -> Usuario:
    return criar_usuario(email, is_staff=True)


def autenticar(cliente: APIClient, usuario: Usuario) -> None:
    """Autentica pelo caminho real: token de acesso no cabeçalho."""
    cliente.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(usuario)}')


class BasePainelTests(APITestCase):
    """O limite de tentativas vive no cache e precisa ser zerado entre testes."""

    def setUp(self) -> None:
        cache.clear()


class CadastroTests(BasePainelTests):
    """Endpoint público de criação de conta."""

    def setUp(self) -> None:
        super().setUp()
        self.url = reverse('cadastro')

    def payload(self, **campos) -> dict:
        dados = {'email': 'novo@example.com', 'password': SENHA, 'nome': 'Ana'}
        dados.update(campos)
        return dados

    def test_cadastro_valido_cria_conta_de_usuario(self) -> None:
        resposta = self.client.post(self.url, self.payload(), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        conta = Usuario.objects.get(username='novo@example.com')
        self.assertEqual(conta.first_name, 'Ana')
        self.assertFalse(conta.is_staff)
        self.assertFalse(conta.is_superuser)
        self.assertEqual(resposta.data['nivel'], Nivel.USUARIO)

    def test_conta_nasce_com_perfil(self) -> None:
        self.client.post(self.url, self.payload(), format='json')

        conta = Usuario.objects.get(username='novo@example.com')
        self.assertTrue(Perfil.objects.filter(usuario=conta).exists())

    def test_resposta_nao_traz_senha_nem_hash(self) -> None:
        resposta = self.client.post(self.url, self.payload(), format='json')

        self.assertNotIn('password', resposta.data)
        conta = Usuario.objects.get(username='novo@example.com')
        self.assertNotIn(conta.password, str(resposta.data))

    def test_senha_e_guardada_com_hash(self) -> None:
        self.client.post(self.url, self.payload(), format='json')

        conta = Usuario.objects.get(username='novo@example.com')
        self.assertNotEqual(conta.password, SENHA)
        self.assertTrue(conta.check_password(SENHA))

    def test_email_e_normalizado(self) -> None:
        resposta = self.client.post(self.url, self.payload(email='Novo@Example.COM'), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Usuario.objects.filter(username='novo@example.com').exists())

    def test_cadastro_nao_devolve_token(self) -> None:
        resposta = self.client.post(self.url, self.payload(), format='json')

        self.assertNotIn('access', resposta.data)
        self.assertNotIn('refresh', resposta.data)

    def test_campos_obrigatorios(self) -> None:
        resposta = self.client.post(self.url, {}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', resposta.data)
        self.assertIn('password', resposta.data)

    def test_email_invalido(self) -> None:
        resposta = self.client.post(self.url, self.payload(email='nao-e-email'), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', resposta.data)

    def test_senha_fraca_e_recusada(self) -> None:
        resposta = self.client.post(self.url, self.payload(password='123'), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', resposta.data)

    def test_senha_parecida_com_o_email_e_recusada(self) -> None:
        resposta = self.client.post(
            self.url, self.payload(email='ana.souza@example.com', password='ana.souza'), format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', resposta.data)

    def test_email_duplicado_e_recusado(self) -> None:
        criar_usuario('novo@example.com')

        resposta = self.client.post(self.url, self.payload(), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', resposta.data)

    def test_email_duplicado_ignora_maiusculas(self) -> None:
        criar_usuario('novo@example.com')

        resposta = self.client.post(self.url, self.payload(email='NOVO@example.com'), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_email_duplicado_de_conta_com_outro_username(self) -> None:
        Usuario.objects.create_user(username='root', email='novo@example.com', password=SENHA)

        resposta = self.client.post(self.url, self.payload(), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', resposta.data)

    def test_payload_nao_cria_conta_admin(self) -> None:
        resposta = self.client.post(
            self.url,
            self.payload(is_staff=True, is_superuser=True, nivel=Nivel.ADMIN, role='admin'),
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        conta = Usuario.objects.get(username='novo@example.com')
        self.assertFalse(conta.is_staff)
        self.assertFalse(conta.is_superuser)
        self.assertEqual(resposta.data['nivel'], Nivel.USUARIO)

    def test_payload_com_permissoes_e_ignorado(self) -> None:
        resposta = self.client.post(
            self.url, self.payload(groups=[1], user_permissions=[1]), format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        conta = Usuario.objects.get(username='novo@example.com')
        self.assertEqual(conta.groups.count(), 0)
        self.assertEqual(conta.user_permissions.count(), 0)

    def test_payload_com_id_e_ignorado(self) -> None:
        resposta = self.client.post(self.url, self.payload(id=9999, pk=9999), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertFalse(Usuario.objects.filter(pk=9999).exists())


class AutenticacaoTests(BasePainelTests):
    """Login, token, renovação e logout."""

    def setUp(self) -> None:
        super().setUp()
        self.usuario = criar_usuario()
        self.url_login = reverse('login')

    def test_login_valido_devolve_os_dois_tokens(self) -> None:
        resposta = self.client.post(
            self.url_login, {'email': self.usuario.email, 'password': SENHA}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertIn('access', resposta.data)
        self.assertIn('refresh', resposta.data)

    def test_login_aceita_email_em_maiusculas(self) -> None:
        resposta = self.client.post(
            self.url_login, {'email': 'CLIENTE@example.com', 'password': SENHA}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

    def test_login_com_senha_errada(self) -> None:
        resposta = self.client.post(
            self.url_login, {'email': self.usuario.email, 'password': 'errada'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('access', resposta.data)

    def test_login_com_email_inexistente(self) -> None:
        resposta = self.client.post(
            self.url_login, {'email': 'ninguem@example.com', 'password': SENHA}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_de_conta_desativada(self) -> None:
        self.usuario.is_active = False
        self.usuario.save(update_fields=('is_active',))

        resposta = self.client.post(
            self.url_login, {'email': self.usuario.email, 'password': SENHA}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_com_tentativa_de_injecao(self) -> None:
        resposta = self.client.post(
            self.url_login, {'email': "' OR 1=1 --", 'password': SENHA}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Usuario.objects.filter(pk=self.usuario.pk).exists())

    def test_endpoint_protegido_sem_token(self) -> None:
        resposta = self.client.get(reverse('perfil'))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_invalido(self) -> None:
        self.client.credentials(HTTP_AUTHORIZATION='Bearer abc.def.ghi')

        resposta = self.client.get(reverse('perfil'))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_expirado(self) -> None:
        token = AccessToken.for_user(self.usuario)
        token.set_exp(lifetime=-timedelta(minutes=5))
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        resposta = self.client.get(reverse('perfil'))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_devolve_novo_access(self) -> None:
        refresh = str(RefreshToken.for_user(self.usuario))

        resposta = self.client.post(reverse('refresh'), {'refresh': refresh}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertIn('access', resposta.data)

    def test_refresh_usado_duas_vezes_e_recusado(self) -> None:
        refresh = str(RefreshToken.for_user(self.usuario))
        self.client.post(reverse('refresh'), {'refresh': refresh}, format='json')

        resposta = self.client.post(reverse('refresh'), {'refresh': refresh}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_de_conta_apagada(self) -> None:
        conta = criar_usuario('apagada@example.com')
        refresh = str(RefreshToken.for_user(conta))
        conta.delete()

        resposta = self.client.post(reverse('refresh'), {'refresh': refresh}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_invalida_o_refresh(self) -> None:
        refresh = str(RefreshToken.for_user(self.usuario))

        resposta = self.client.post(reverse('logout'), {'refresh': refresh}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        depois = self.client.post(reverse('refresh'), {'refresh': refresh}, format='json')
        self.assertEqual(depois.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_conta_desativada_perde_acesso_com_token_valido(self) -> None:
        autenticar(self.client, self.usuario)
        self.usuario.is_active = False
        self.usuario.save(update_fields=('is_active',))

        resposta = self.client.get(reverse('perfil'))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_excesso_de_tentativas_de_login_e_bloqueado(self) -> None:
        dados = {'email': self.usuario.email, 'password': 'errada'}
        for _ in range(10):
            self.client.post(self.url_login, dados, format='json')

        resposta = self.client.post(self.url_login, dados, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class PerfilTests(BasePainelTests):
    """Cada conta enxerga e edita apenas o próprio perfil."""

    def setUp(self) -> None:
        super().setUp()
        self.usuario = criar_usuario()
        self.outro = criar_usuario('outro@example.com')
        self.url = reverse('perfil')
        autenticar(self.client, self.usuario)

    def test_usuario_ve_o_proprio_perfil(self) -> None:
        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['email'], self.usuario.email)
        self.assertEqual(resposta.data['nivel'], Nivel.USUARIO)

    def test_perfil_nao_expoe_campos_internos(self) -> None:
        resposta = self.client.get(self.url)

        for campo in ('password', 'is_staff', 'is_superuser', 'groups', 'user_permissions', 'id'):
            self.assertNotIn(campo, resposta.data)

    def test_cada_conta_ve_o_seu_perfil(self) -> None:
        autenticar(self.client, self.outro)

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.data['email'], self.outro.email)

    def test_usuario_edita_nome_e_telefone(self) -> None:
        resposta = self.client.patch(
            self.url, {'nome': 'Ana', 'sobrenome': 'Souza', 'telefone': '11 98888-7777'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.first_name, 'Ana')
        self.assertEqual(self.usuario.last_name, 'Souza')
        self.assertEqual(self.usuario.perfil.telefone, '11 98888-7777')

    def test_put_atualiza_apenas_o_permitido(self) -> None:
        resposta = self.client.put(
            self.url,
            {'nome': 'Ana', 'sobrenome': 'Souza', 'telefone': '11988887777', 'email': 'outro@example.com',
             'nivel': Nivel.ADMIN, 'is_staff': True},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.email, 'cliente@example.com')
        self.assertFalse(self.usuario.is_staff)

    def test_telefone_invalido(self) -> None:
        resposta = self.client.patch(self.url, {'telefone': 'telefone'}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('telefone', resposta.data)

    def test_patch_nao_muda_o_nivel(self) -> None:
        resposta = self.client.patch(self.url, {'nivel': Nivel.ADMIN}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.usuario.refresh_from_db()
        self.assertFalse(self.usuario.is_staff)
        self.assertEqual(resposta.data['nivel'], Nivel.USUARIO)

    def test_patch_nao_muda_is_staff(self) -> None:
        self.client.patch(self.url, {'is_staff': True}, format='json')

        self.usuario.refresh_from_db()
        self.assertFalse(self.usuario.is_staff)

    def test_patch_nao_muda_is_superuser(self) -> None:
        self.client.patch(self.url, {'is_superuser': True}, format='json')

        self.usuario.refresh_from_db()
        self.assertFalse(self.usuario.is_superuser)

    def test_patch_nao_muda_permissoes(self) -> None:
        self.client.patch(self.url, {'groups': [1], 'user_permissions': [1]}, format='json')

        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.groups.count(), 0)
        self.assertEqual(self.usuario.user_permissions.count(), 0)

    def test_patch_com_id_de_outra_conta_nao_afeta_ninguem(self) -> None:
        resposta = self.client.patch(
            self.url, {'id': self.outro.pk, 'usuario': self.outro.pk, 'nome': 'Invasor'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.outro.refresh_from_db()
        self.usuario.refresh_from_db()
        self.assertEqual(self.outro.first_name, '')
        self.assertEqual(self.usuario.first_name, 'Invasor')

    def test_perfil_nao_aceita_exclusao(self) -> None:
        resposta = self.client.delete(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_perfil_de_admin_mostra_nivel_admin(self) -> None:
        autenticar(self.client, criar_admin())

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.data['nivel'], Nivel.ADMIN)


class AutorizacaoUsuarioComumTests(BasePainelTests):
    """O que a conta comum não pode fazer."""

    @classmethod
    def setUpTestData(cls) -> None:
        cls.subtipo = Subtipo.objects.create(
            nome='Painel vape', slug='painel-teste-vape', categoria=Categoria.VAPE
        )
        cls.produto = Produto.objects.create(
            subtipo=cls.subtipo,
            sku='PNL-0001',
            nome='Kit',
            marca='Marca',
            preco=Decimal('250.00'),
            estoque=5,
        )

    def setUp(self) -> None:
        super().setUp()
        self.usuario = criar_usuario()
        self.outro = criar_usuario('outro@example.com')
        autenticar(self.client, self.usuario)

    def test_usuario_nao_lista_contas(self) -> None:
        resposta = self.client.get(reverse('usuario-list'))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_nao_ve_conta_de_outro(self) -> None:
        resposta = self.client.get(reverse('usuario-detail', args=[self.outro.pk]))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_nao_altera_conta_de_outro(self) -> None:
        resposta = self.client.patch(
            reverse('usuario-detail', args=[self.outro.pk]), {'ativo': False}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.outro.refresh_from_db()
        self.assertTrue(self.outro.is_active)

    def test_usuario_nao_promove_ninguem(self) -> None:
        resposta = self.client.post(
            reverse('usuario-nivel', args=[self.outro.pk]), {'nivel': Nivel.ADMIN}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.outro.refresh_from_db()
        self.assertFalse(self.outro.is_staff)

    def test_usuario_nao_promove_a_propria_conta(self) -> None:
        resposta = self.client.post(
            reverse('usuario-nivel', args=[self.usuario.pk]), {'nivel': Nivel.ADMIN}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.usuario.refresh_from_db()
        self.assertFalse(self.usuario.is_staff)

    def test_anonimo_nao_lista_contas(self) -> None:
        self.client.credentials()

        resposta = self.client.get(reverse('usuario-list'))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_usuario_ve_o_catalogo(self) -> None:
        resposta = self.client.get(reverse('produto-list'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

    def test_usuario_nao_ve_estoque_no_catalogo(self) -> None:
        resposta = self.client.get(reverse('produto-detail', args=[self.produto.id]))

        self.assertNotIn('estoque', resposta.data)

    def test_usuario_nao_cadastra_produto(self) -> None:
        resposta = self.client.post(
            reverse('produto-list'),
            {'sku': 'PNL-0002', 'nome': 'Novo', 'marca': 'M', 'preco': '10.00', 'subtipo': self.subtipo.slug},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Produto.objects.count(), 1)

    def test_usuario_nao_altera_produto(self) -> None:
        resposta = self.client.patch(
            reverse('produto-detail', args=[self.produto.id]), {'nome': 'Alterado'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_nao_altera_preco(self) -> None:
        resposta = self.client.patch(
            reverse('produto-detail', args=[self.produto.id]), {'preco': '1.00'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.preco, Decimal('250.00'))

    def test_usuario_nao_altera_estoque(self) -> None:
        resposta = self.client.post(
            reverse('produto-estoque', args=[self.produto.id]), {'delta': 100}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.estoque, 5)

    def test_usuario_nao_exclui_produto(self) -> None:
        resposta = self.client.delete(reverse('produto-detail', args=[self.produto.id]))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Produto.objects.filter(pk=self.produto.pk).exists())


class AdministracaoDeContasTests(BasePainelTests):
    """Endpoints administrativos de usuários."""

    def setUp(self) -> None:
        super().setUp()
        self.admin = criar_admin()
        self.usuario = criar_usuario()
        self.superusuario = Usuario.objects.create_superuser(
            username='root@example.com', email='root@example.com', password=SENHA
        )
        autenticar(self.client, self.admin)

    def test_admin_lista_contas(self) -> None:
        resposta = self.client.get(reverse('usuario-list'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['count'], 3)

    def test_lista_nao_traz_senha(self) -> None:
        resposta = self.client.get(reverse('usuario-list'))

        for conta in resposta.data['results']:
            self.assertNotIn('password', conta)

    def test_admin_ve_detalhe_da_conta(self) -> None:
        resposta = self.client.get(reverse('usuario-detail', args=[self.usuario.pk]))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['email'], self.usuario.email)
        self.assertEqual(resposta.data['nivel'], Nivel.USUARIO)

    def test_conta_inexistente(self) -> None:
        resposta = self.client.get(reverse('usuario-detail', args=[999999]))

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_exclusao_de_conta_nao_e_permitida(self) -> None:
        resposta = self.client.delete(reverse('usuario-detail', args=[self.usuario.pk]))

        self.assertEqual(resposta.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Usuario.objects.filter(pk=self.usuario.pk).exists())

    def test_admin_promove_conta(self) -> None:
        resposta = self.client.post(
            reverse('usuario-nivel', args=[self.usuario.pk]), {'nivel': Nivel.ADMIN}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['nivel'], Nivel.ADMIN)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.is_staff)

    def test_promocao_nao_concede_superusuario(self) -> None:
        self.client.post(
            reverse('usuario-nivel', args=[self.usuario.pk]), {'nivel': Nivel.ADMIN}, format='json'
        )

        self.usuario.refresh_from_db()
        self.assertFalse(self.usuario.is_superuser)

    def test_admin_rebaixa_conta(self) -> None:
        outro_admin = criar_admin('admin2@example.com')

        resposta = self.client.post(
            reverse('usuario-nivel', args=[outro_admin.pk]), {'nivel': Nivel.USUARIO}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        outro_admin.refresh_from_db()
        self.assertFalse(outro_admin.is_staff)

    def test_admin_nao_altera_o_proprio_nivel(self) -> None:
        resposta = self.client.post(
            reverse('usuario-nivel', args=[self.admin.pk]), {'nivel': Nivel.USUARIO}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_staff)

    def test_admin_nao_altera_nivel_de_superusuario(self) -> None:
        resposta = self.client.post(
            reverse('usuario-nivel', args=[self.superusuario.pk]), {'nivel': Nivel.USUARIO}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.superusuario.refresh_from_db()
        self.assertTrue(self.superusuario.is_staff)

    def test_nivel_invalido(self) -> None:
        resposta = self.client.post(
            reverse('usuario-nivel', args=[self.usuario.pk]), {'nivel': 'dono'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nivel', resposta.data)

    def test_nivel_ausente(self) -> None:
        resposta = self.client.post(reverse('usuario-nivel', args=[self.usuario.pk]), {}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_desativa_conta(self) -> None:
        resposta = self.client.patch(
            reverse('usuario-detail', args=[self.usuario.pk]), {'ativo': False}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.usuario.refresh_from_db()
        self.assertFalse(self.usuario.is_active)

    def test_admin_nao_desativa_a_propria_conta(self) -> None:
        resposta = self.client.patch(
            reverse('usuario-detail', args=[self.admin.pk]), {'ativo': False}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_admin_nao_desativa_superusuario(self) -> None:
        resposta = self.client.patch(
            reverse('usuario-detail', args=[self.superusuario.pk]), {'ativo': False}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.superusuario.refresh_from_db()
        self.assertTrue(self.superusuario.is_active)

    def test_patch_nao_altera_privilegio(self) -> None:
        resposta = self.client.patch(
            reverse('usuario-detail', args=[self.usuario.pk]),
            {'is_staff': True, 'is_superuser': True, 'nivel': Nivel.ADMIN},
            format='json',
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.usuario.refresh_from_db()
        self.assertFalse(self.usuario.is_staff)
        self.assertFalse(self.usuario.is_superuser)

    def test_admin_rebaixado_perde_acesso_na_hora(self) -> None:
        outro_admin = criar_admin('admin2@example.com')
        autenticar(self.client, outro_admin)
        self.assertEqual(self.client.get(reverse('usuario-list')).status_code, status.HTTP_200_OK)

        outro_admin.is_staff = False
        outro_admin.save(update_fields=('is_staff',))

        resposta = self.client.get(reverse('usuario-list'))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)


class EnderecoTests(BasePainelTests):
    """Endereços do cliente."""

    def setUp(self) -> None:
        super().setUp()
        self.usuario = criar_usuario()
        self.outro = criar_usuario('outro@example.com')
        autenticar(self.client, self.usuario)

    def payload(self, **campos) -> dict:
        dados = {
            'apelido': 'casa',
            'cep': '01001000',
            'logradouro': 'Praça da Sé',
            'numero': '100',
            'bairro': 'Sé',
            'cidade': 'São Paulo',
            'uf': 'SP',
        }
        dados.update(campos)
        return dados

    def criar_para(self, usuario: Usuario, **campos) -> Endereco:
        return Endereco.objects.create(usuario=usuario, **self.payload(**campos))

    def test_cliente_cadastra_endereco(self) -> None:
        resposta = self.client.post(reverse('endereco-list'), self.payload(), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Endereco.objects.get().usuario, self.usuario)

    def test_dono_vem_do_token_e_nao_do_payload(self) -> None:
        self.client.post(
            reverse('endereco-list'), self.payload(usuario=self.outro.pk), format='json'
        )

        self.assertEqual(Endereco.objects.get().usuario, self.usuario)

    def test_cliente_pode_ter_varios_enderecos(self) -> None:
        self.client.post(reverse('endereco-list'), self.payload(apelido='casa'), format='json')
        self.client.post(reverse('endereco-list'), self.payload(apelido='trabalho'), format='json')

        resposta = self.client.get(reverse('endereco-list'))

        self.assertEqual(resposta.data['count'], 2)

    def test_lista_traz_apenas_os_proprios(self) -> None:
        self.criar_para(self.usuario)
        self.criar_para(self.outro, cidade='Santos')

        resposta = self.client.get(reverse('endereco-list'))

        self.assertEqual(resposta.data['count'], 1)
        self.assertEqual(resposta.data['results'][0]['cidade'], 'São Paulo')

    def test_cliente_altera_o_proprio_endereco(self) -> None:
        endereco = self.criar_para(self.usuario)

        resposta = self.client.patch(
            reverse('endereco-detail', args=[endereco.pk]), {'numero': '250'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        endereco.refresh_from_db()
        self.assertEqual(endereco.numero, '250')

    def test_cliente_exclui_o_proprio_endereco(self) -> None:
        endereco = self.criar_para(self.usuario)

        resposta = self.client.delete(reverse('endereco-detail', args=[endereco.pk]))

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Endereco.objects.filter(pk=endereco.pk).exists())

    def test_cep_invalido(self) -> None:
        resposta = self.client.post(reverse('endereco-list'), self.payload(cep='01001-000'), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cep', resposta.data)

    def test_uf_invalida(self) -> None:
        resposta = self.client.post(reverse('endereco-list'), self.payload(uf='XX'), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('uf', resposta.data)

    def test_campos_obrigatorios(self) -> None:
        resposta = self.client.post(reverse('endereco-list'), {}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        for campo in ('cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'):
            self.assertIn(campo, resposta.data)

    def test_nao_le_endereco_de_outra_conta(self) -> None:
        endereco = self.criar_para(self.outro)

        resposta = self.client.get(reverse('endereco-detail', args=[endereco.pk]))

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_nao_altera_endereco_de_outra_conta(self) -> None:
        endereco = self.criar_para(self.outro)

        resposta = self.client.patch(
            reverse('endereco-detail', args=[endereco.pk]), {'numero': '999'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
        endereco.refresh_from_db()
        self.assertEqual(endereco.numero, '100')

    def test_nao_exclui_endereco_de_outra_conta(self) -> None:
        endereco = self.criar_para(self.outro)

        resposta = self.client.delete(reverse('endereco-detail', args=[endereco.pk]))

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Endereco.objects.filter(pk=endereco.pk).exists())

    def test_sem_autenticacao(self) -> None:
        self.client.credentials()

        resposta = self.client.get(reverse('endereco-list'))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)


class AlterarSenhaTests(BasePainelTests):
    """Troca de senha pela própria conta."""

    NOVA_SENHA = 'Outra-Senha-Forte-2026'

    def setUp(self) -> None:
        super().setUp()
        self.usuario = criar_usuario()
        self.outro = criar_usuario('outro@example.com')
        autenticar(self.client, self.usuario)
        self.url = reverse('alterar-senha')

    def test_troca_valida(self) -> None:
        resposta = self.client.post(
            self.url, {'senha_atual': SENHA, 'nova_senha': self.NOVA_SENHA}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.check_password(self.NOVA_SENHA))

    def test_login_passa_a_usar_a_nova_senha(self) -> None:
        self.client.post(self.url, {'senha_atual': SENHA, 'nova_senha': self.NOVA_SENHA}, format='json')

        anonimo = APIClient()
        antiga = anonimo.post(
            reverse('login'), {'email': self.usuario.email, 'password': SENHA}, format='json'
        )
        nova = anonimo.post(
            reverse('login'), {'email': self.usuario.email, 'password': self.NOVA_SENHA}, format='json'
        )

        self.assertEqual(antiga.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(nova.status_code, status.HTTP_200_OK)

    def test_senha_atual_incorreta(self) -> None:
        resposta = self.client.post(
            self.url, {'senha_atual': 'errada', 'nova_senha': self.NOVA_SENHA}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('senha_atual', resposta.data)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.check_password(SENHA))

    def test_nova_senha_fraca(self) -> None:
        resposta = self.client.post(
            self.url, {'senha_atual': SENHA, 'nova_senha': '123'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nova_senha', resposta.data)

    def test_troca_derruba_os_refresh_antigos(self) -> None:
        refresh = str(RefreshToken.for_user(self.usuario))

        self.client.post(self.url, {'senha_atual': SENHA, 'nova_senha': self.NOVA_SENHA}, format='json')

        resposta = APIClient().post(reverse('refresh'), {'refresh': refresh}, format='json')
        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_nao_mexe_na_senha_de_outra_conta(self) -> None:
        self.client.post(
            self.url,
            {'senha_atual': SENHA, 'nova_senha': self.NOVA_SENHA, 'usuario': self.outro.pk, 'id': self.outro.pk},
            format='json',
        )

        self.outro.refresh_from_db()
        self.assertTrue(self.outro.check_password(SENHA))

    def test_sem_autenticacao(self) -> None:
        self.client.credentials()

        resposta = self.client.post(
            self.url, {'senha_atual': SENHA, 'nova_senha': self.NOVA_SENHA}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)


class RecuperacaoDeSenhaTests(BasePainelTests):
    """Esqueci a senha: pedido, e-mail e redefinição."""

    NOVA_SENHA = 'Outra-Senha-Forte-2026'

    def setUp(self) -> None:
        super().setUp()
        self.usuario = criar_usuario()
        self.url_pedido = reverse('recuperar-senha')
        self.url_redefinicao = reverse('redefinir-senha')

    def credenciais(self, usuario: Usuario | None = None) -> dict:
        conta = usuario or self.usuario
        return {
            'uid': urlsafe_base64_encode(force_bytes(conta.pk)),
            'token': default_token_generator.make_token(conta),
        }

    def test_pedido_envia_o_email(self) -> None:
        resposta = self.client.post(self.url_pedido, {'email': self.usuario.email}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('redefinir-senha', mail.outbox[0].body)

    def test_email_inexistente_responde_igual(self) -> None:
        existente = self.client.post(self.url_pedido, {'email': self.usuario.email}, format='json')
        mail.outbox.clear()

        inexistente = self.client.post(self.url_pedido, {'email': 'ninguem@example.com'}, format='json')

        self.assertEqual(inexistente.status_code, existente.status_code)
        self.assertEqual(inexistente.data, existente.data)
        self.assertEqual(len(mail.outbox), 0)

    def test_conta_desativada_nao_recebe_email(self) -> None:
        self.usuario.is_active = False
        self.usuario.save(update_fields=('is_active',))

        resposta = self.client.post(self.url_pedido, {'email': self.usuario.email}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(len(mail.outbox), 0)

    def test_email_invalido(self) -> None:
        resposta = self.client.post(self.url_pedido, {'email': 'nao-e-email'}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_redefinicao_valida(self) -> None:
        resposta = self.client.post(
            self.url_redefinicao, {**self.credenciais(), 'nova_senha': self.NOVA_SENHA}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.check_password(self.NOVA_SENHA))

    def test_token_invalido(self) -> None:
        dados = {**self.credenciais(), 'token': 'abc-invalido', 'nova_senha': self.NOVA_SENHA}

        resposta = self.client.post(self.url_redefinicao, dados, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.check_password(SENHA))

    def test_uid_invalido(self) -> None:
        dados = {**self.credenciais(), 'uid': 'nao-existe', 'nova_senha': self.NOVA_SENHA}

        resposta = self.client.post(self.url_redefinicao, dados, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_token_de_outra_conta(self) -> None:
        outro = criar_usuario('outro@example.com')
        dados = {
            'uid': urlsafe_base64_encode(force_bytes(self.usuario.pk)),
            'token': default_token_generator.make_token(outro),
            'nova_senha': self.NOVA_SENHA,
        }

        resposta = self.client.post(self.url_redefinicao, dados, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_token_nao_serve_duas_vezes(self) -> None:
        dados = {**self.credenciais(), 'nova_senha': self.NOVA_SENHA}
        self.client.post(self.url_redefinicao, dados, format='json')

        resposta = self.client.post(self.url_redefinicao, dados, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(PASSWORD_RESET_TIMEOUT=-1)
    def test_token_expirado(self) -> None:
        dados = {**self.credenciais(), 'nova_senha': self.NOVA_SENHA}

        resposta = self.client.post(self.url_redefinicao, dados, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nova_senha_fraca(self) -> None:
        resposta = self.client.post(
            self.url_redefinicao, {**self.credenciais(), 'nova_senha': '123'}, format='json'
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nova_senha', resposta.data)

    def test_redefinicao_derruba_os_refresh_antigos(self) -> None:
        refresh = str(RefreshToken.for_user(self.usuario))

        self.client.post(
            self.url_redefinicao, {**self.credenciais(), 'nova_senha': self.NOVA_SENHA}, format='json'
        )

        resposta = self.client.post(reverse('refresh'), {'refresh': refresh}, format='json')
        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)


class IntegracaoComLojaTests(BasePainelTests):
    """A autorização da painel governa os endpoints da loja."""

    @classmethod
    def setUpTestData(cls) -> None:
        cls.subtipo = Subtipo.objects.create(
            nome='Integração vape', slug='integracao-vape', categoria=Categoria.VAPE
        )

    def setUp(self) -> None:
        super().setUp()
        self.admin = criar_admin()
        self.usuario = criar_usuario()
        self.cliente_admin = APIClient()
        autenticar(self.cliente_admin, self.admin)

    def criar_produto(self, sku: str = 'INT-0001', estoque: int = 3) -> Produto:
        return Produto.objects.create(
            subtipo=self.subtipo,
            sku=sku,
            nome='Kit',
            marca='Marca',
            preco=Decimal('199.90'),
            estoque=estoque,
        )

    def payload_produto(self, sku: str) -> dict:
        return {
            'sku': sku,
            'nome': 'Kit novo',
            'marca': 'Marca',
            'preco': '199.90',
            'subtipo': self.subtipo.slug,
        }

    def test_conta_promovida_passa_a_gerenciar_o_catalogo(self) -> None:
        autenticar(self.client, self.usuario)
        negado = self.client.post(reverse('produto-list'), self.payload_produto('INT-0010'), format='json')
        self.assertEqual(negado.status_code, status.HTTP_403_FORBIDDEN)

        promocao = self.cliente_admin.post(
            reverse('usuario-nivel', args=[self.usuario.pk]), {'nivel': Nivel.ADMIN}, format='json'
        )
        self.assertEqual(promocao.status_code, status.HTTP_200_OK)

        # Mesmo token de antes: o privilégio vem do banco, não do token.
        criado = self.client.post(reverse('produto-list'), self.payload_produto('INT-0010'), format='json')

        self.assertEqual(criado.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Produto.objects.filter(sku='INT-0010').exists())

    def test_conta_rebaixada_perde_a_gestao_do_catalogo(self) -> None:
        produto = self.criar_produto()
        gestor = criar_admin('gestor@example.com')
        autenticar(self.client, gestor)
        url_estoque = reverse('produto-estoque', args=[produto.id])
        self.assertEqual(
            self.client.post(url_estoque, {'delta': 2}, format='json').status_code, status.HTTP_200_OK
        )

        self.cliente_admin.post(
            reverse('usuario-nivel', args=[gestor.pk]), {'nivel': Nivel.USUARIO}, format='json'
        )

        resposta = self.client.post(url_estoque, {'delta': 2}, format='json')

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        produto.refresh_from_db()
        self.assertEqual(produto.estoque, 5)

    def test_admin_ve_o_estoque_no_catalogo(self) -> None:
        produto = self.criar_produto(estoque=7)

        resposta = self.cliente_admin.get(reverse('produto-detail', args=[produto.id]))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['estoque'], 7)

    def test_conta_desativada_perde_a_gestao_do_catalogo(self) -> None:
        gestor = criar_admin('gestor@example.com')
        autenticar(self.client, gestor)

        self.cliente_admin.patch(
            reverse('usuario-detail', args=[gestor.pk]), {'ativo': False}, format='json'
        )

        resposta = self.client.post(reverse('produto-list'), self.payload_produto('INT-0011'), format='json')

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(Produto.objects.filter(sku='INT-0011').exists())
