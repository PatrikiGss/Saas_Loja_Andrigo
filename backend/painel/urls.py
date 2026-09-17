"""Rotas de conta, perfil e administração de usuários."""
from django.urls import path
from rest_framework.routers import SimpleRouter
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

from painel.views import CadastroView, LoginView, PerfilView, UsuarioViewSet

router = SimpleRouter()
router.register('usuarios', UsuarioViewSet, basename='usuario')

urlpatterns = [
    path('auth/cadastro/', CadastroView.as_view(), name='cadastro'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('auth/logout/', TokenBlacklistView.as_view(), name='logout'),
    path('perfil/', PerfilView.as_view(), name='perfil'),
    *router.urls,
]
