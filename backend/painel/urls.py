"""Rotas de conta, perfil e administração de usuários."""
from django.urls import path
from rest_framework.routers import SimpleRouter
from rest_framework_simplejwt.views import TokenBlacklistView

from painel.views import (
    AlterarSenhaView,
    CadastroView,
    EnderecoViewSet,
    LoginView,
    PerfilView,
    RecuperarSenhaView,
    RedefinirSenhaView,
    RefreshView,
    UsuarioViewSet,
)

router = SimpleRouter()
router.register('usuarios', UsuarioViewSet, basename='usuario')
router.register('enderecos', EnderecoViewSet, basename='endereco')

urlpatterns = [
    path('auth/cadastro/', CadastroView.as_view(), name='cadastro'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh'),
    path('auth/logout/', TokenBlacklistView.as_view(), name='logout'),
    path('auth/senha/', AlterarSenhaView.as_view(), name='alterar-senha'),
    path('auth/senha/recuperar/', RecuperarSenhaView.as_view(), name='recuperar-senha'),
    path('auth/senha/redefinir/', RedefinirSenhaView.as_view(), name='redefinir-senha'),
    path('perfil/', PerfilView.as_view(), name='perfil'),
    *router.urls,
]
