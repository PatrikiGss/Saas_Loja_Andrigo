"""Endpoints de conta, perfil e administração de usuários."""

from __future__ import annotations

from axes.utils import reset
from django.contrib.auth import get_user_model
from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from painel import cookies
from painel.auditoria import registrar
from painel.emails import enviar_ativacao_de_conta, enviar_recuperacao_de_senha
from painel.models import Endereco, Perfil, definir_nivel, invalidar_tokens, nivel_de
from painel.permissions import EhAdmin
from painel.serializers import (
    AlteracaoNivelSerializer,
    AlterarSenhaSerializer,
    AtivarContaSerializer,
    CadastroSerializer,
    ContaCriadaSerializer,
    EnderecoSerializer,
    LoginSerializer,
    PerfilSerializer,
    RecuperarSenhaSerializer,
    RedefinirSenhaSerializer,
    RefreshSerializer,
    UsuarioAdminSerializer,
)

Usuario = get_user_model()

#: O que o login e a renovação devolvem no corpo. O refresh não aparece: ele
#: sai pelo cookie httpOnly e nunca passa pelo JavaScript.
ACESSO = inline_serializer('Acesso', {'access': serializers.CharField()})


@extend_schema(responses={201: ContaCriadaSerializer})
class CadastroView(generics.CreateAPIView):
    """Cria contas de nível usuário. Público, com limite de tentativas.

    A conta nasce desativada e só passa a funcionar depois que a pessoa
    confirma o e-mail, o que encarece a criação de conta em massa.
    """

    serializer_class = CadastroSerializer
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'auth'

    def perform_create(self, serializer: CadastroSerializer) -> None:
        conta = serializer.save()
        enviar_ativacao_de_conta(conta)


class AtivarContaView(generics.GenericAPIView):
    """Confirma o e-mail do cadastro e libera a conta."""

    serializer_class = AtivarContaSerializer
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'auth'

    @extend_schema(responses={204: None})
    def post(self, request: Request) -> Response:
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        usuario = entrada.validated_data['usuario']
        usuario.is_active = True
        usuario.save(update_fields=('is_active',))

        return Response(status=status.HTTP_204_NO_CONTENT)


class LoginView(TokenObtainPairView):
    """Emite o access token no corpo e o refresh em cookie httpOnly.

    Duas barreiras contra força bruta: o limite por minuto, que é por IP, e o
    bloqueio por conta depois de algumas senhas erradas.
    """

    serializer_class = LoginSerializer
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'auth'

    @extend_schema(responses=ACESSO)
    def post(self, request: Request, *args, **kwargs) -> Response:
        resposta = super().post(request, *args, **kwargs)

        if resposta.status_code == status.HTTP_200_OK:
            # O axes zera a contagem no `login()` do Django, que o JWT nunca
            # chama. Sem isto, quem errou algumas vezes e depois acertou
            # continuaria com as falhas penduradas.
            reset(username=str(request.data.get('email', '')).strip().lower())
            cookies.mover_do_corpo(resposta)

        return resposta


class RefreshView(TokenRefreshView):
    """Renova o access token a partir do cookie.

    O refresh não vem do corpo e não volta no corpo: entra e sai pelo cookie
    httpOnly, então nenhuma linha de JavaScript encosta nele. Conta apagada
    responde 401, e não erro 500.
    """

    serializer_class = RefreshSerializer
    permission_classes = (permissions.AllowAny,)

    @extend_schema(request=None, responses=ACESSO)
    def post(self, request: Request, *args, **kwargs) -> Response:
        entrada = self.get_serializer(data={'refresh': cookies.ler(request) or ''})

        try:
            entrada.is_valid(raise_exception=True)
        except (TokenError, ValidationError, AuthenticationFailed):
            return self._sessao_encerrada()

        resposta = Response(dict(entrada.validated_data), status=status.HTTP_200_OK)
        cookies.mover_do_corpo(resposta)
        return resposta

    @staticmethod
    def _sessao_encerrada() -> Response:
        """401 com o cookie apagado.

        Sem apagar, o navegador continuaria mandando um token morto em toda
        tentativa seguinte, e cada uma delas falharia do mesmo jeito.
        """
        resposta = Response(
            {'detail': 'Sessão expirada. Entre de novo.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
        cookies.apagar(resposta)
        return resposta


class LogoutView(APIView):
    """Encerra a sessão: derruba o refresh e apaga o cookie.

    Aberta de propósito. O access token pode já ter expirado quando a pessoa
    clica em sair, e exigir autenticação aqui deixaria o cookie pendurado
    justamente no caso em que ele mais precisa sumir.
    """

    permission_classes = (permissions.AllowAny,)

    @extend_schema(request=None, responses={204: None})
    def post(self, request: Request) -> Response:
        resposta = Response(status=status.HTTP_204_NO_CONTENT)
        cookies.apagar(resposta)

        token = cookies.ler(request)
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                # Token vencido ou já na blacklist: o estado pedido já é o
                # estado atual, então sair continua sendo sucesso.
                pass

        return resposta


class PerfilView(generics.RetrieveUpdateAPIView):
    """Perfil da conta autenticada.

    Não existe id na URL: o objeto vem do token, então não há recurso de outra
    pessoa para pedir.
    """

    serializer_class = PerfilSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self) -> Perfil:
        return self.request.user.perfil


class AlterarSenhaView(generics.GenericAPIView):
    """Troca de senha da própria conta.

    Depois da troca, os refresh tokens em circulação são invalidados: quem
    tiver roubado um deixa de conseguir renovar o acesso.
    """

    serializer_class = AlterarSenhaSerializer
    permission_classes = (permissions.IsAuthenticated,)

    @extend_schema(responses={204: None})
    def post(self, request: Request) -> Response:
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        usuario = request.user
        usuario.set_password(entrada.validated_data['nova_senha'])
        usuario.save(update_fields=('password',))
        invalidar_tokens(usuario)

        return Response(status=status.HTTP_204_NO_CONTENT)


class RecuperarSenhaView(generics.GenericAPIView):
    """Pede o link de recuperação.

    A resposta é 204 exista ou não a conta, então este endpoint não serve
    para descobrir quem tem cadastro.
    """

    serializer_class = RecuperarSenhaSerializer
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'auth'

    @extend_schema(responses={204: None})
    def post(self, request: Request) -> Response:
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        usuario = Usuario.objects.filter(
            email__iexact=entrada.validated_data['email'], is_active=True
        ).first()
        if usuario is not None:
            enviar_recuperacao_de_senha(usuario)

        return Response(status=status.HTTP_204_NO_CONTENT)


class RedefinirSenhaView(generics.GenericAPIView):
    """Define a nova senha a partir do link recebido por e-mail."""

    serializer_class = RedefinirSenhaSerializer
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'auth'

    @extend_schema(responses={204: None})
    def post(self, request: Request) -> Response:
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        usuario = entrada.validated_data['usuario']
        usuario.set_password(entrada.validated_data['nova_senha'])
        usuario.save(update_fields=('password',))
        invalidar_tokens(usuario)

        return Response(status=status.HTTP_204_NO_CONTENT)


class EnderecoViewSet(viewsets.ModelViewSet):
    """Endereços do cliente.

    A consulta nasce restrita à conta autenticada, então o endereço de outra
    pessoa não existe aqui: a resposta é 404.
    """

    serializer_class = EnderecoSerializer
    permission_classes = (permissions.IsAuthenticated,)
    # Só aponta o modelo para o gerador do esquema, que não tem conta para
    # passar no filtro. Quem responde de verdade é o `get_queryset`.
    queryset = Endereco.objects.none()

    def get_queryset(self) -> QuerySet[Endereco]:
        return Endereco.objects.filter(usuario=self.request.user)

    def perform_create(self, serializer: EnderecoSerializer) -> None:
        serializer.save(usuario=self.request.user)


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
        registrar(
            self.request.user,
            'conta_atualizada',
            alvo=f'conta:{serializer.instance.pk}',
            detalhes=f'ativo={serializer.instance.is_active}',
        )

    @extend_schema(request=AlteracaoNivelSerializer, responses=AlteracaoNivelSerializer)
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
        registrar(
            request.user,
            'nivel_alterado',
            alvo=f'conta:{usuario.pk}',
            detalhes=entrada.validated_data['nivel'],
        )

        return Response({'nivel': nivel_de(usuario)}, status=status.HTTP_200_OK)

    def _garantir_conta_administravel(self, usuario: Usuario) -> None:
        """Bloqueia as duas contas que ninguém mexe por este endpoint."""
        if usuario == self.request.user:
            raise PermissionDenied('A própria conta não se altera por aqui.')
        if usuario.is_superuser:
            raise PermissionDenied('Conta protegida.')
