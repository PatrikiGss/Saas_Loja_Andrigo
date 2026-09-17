"""Endpoints de conta, perfil e administração de usuários."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView

from painel.models import Perfil, definir_nivel, nivel_de
from painel.permissions import EhAdmin
from painel.serializers import (
    AlteracaoNivelSerializer,
    CadastroSerializer,
    LoginSerializer,
    PerfilSerializer,
    UsuarioAdminSerializer,
)

Usuario = get_user_model()


class CadastroView(generics.CreateAPIView):
    """Cria contas de nível usuário. Público, com limite de tentativas."""

    serializer_class = CadastroSerializer
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'auth'


class LoginView(TokenObtainPairView):
    """Emite o par de tokens. O limite por minuto dificulta força bruta."""

    serializer_class = LoginSerializer
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'auth'


class PerfilView(generics.RetrieveUpdateAPIView):
    """Perfil da conta autenticada.

    Não existe id na URL: o objeto vem do token, então não há recurso de outra
    pessoa para pedir.
    """

    serializer_class = PerfilSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self) -> Perfil:
        return self.request.user.perfil


class UsuarioViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Administração de contas, exclusiva de admin.

    Não expõe exclusão de conta: desativar é o suficiente e é reversível.
    """

    queryset = Usuario.objects.select_related('perfil').order_by('id')
    serializer_class = UsuarioAdminSerializer
    permission_classes = (EhAdmin,)

    def perform_update(self, serializer: UsuarioAdminSerializer) -> None:
        self._garantir_conta_administravel(serializer.instance)
        serializer.save()

    @action(detail=True, methods=('post',), url_path='nivel', url_name='nivel')
    def alterar_nivel(self, request: Request, pk: str | None = None) -> Response:
        """Promove ou rebaixa uma conta.

        Fica fora do PUT/PATCH de propósito: mudar privilégio é uma operação
        própria, com proteção própria.
        """
        usuario = self.get_object()
        self._garantir_conta_administravel(usuario)

        entrada = AlteracaoNivelSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        definir_nivel(usuario, entrada.validated_data['nivel'])

        return Response({'nivel': nivel_de(usuario)}, status=status.HTTP_200_OK)

    def _garantir_conta_administravel(self, usuario: Usuario) -> None:
        """Bloqueia as duas contas que ninguém mexe por este endpoint."""
        if usuario == self.request.user:
            raise PermissionDenied('A própria conta não se altera por aqui.')
        if usuario.is_superuser:
            raise PermissionDenied('Conta protegida.')
