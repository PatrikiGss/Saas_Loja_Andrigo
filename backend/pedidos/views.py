"""Endpoints de checkout, pedidos, frete e CEP."""

from __future__ import annotations

from django.core.exceptions import ValidationError as ErroDeValidacaoDoModelo
from django.db import transaction
from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from carrinho.models import Carrinho
from painel.auditoria import registrar
from painel.permissions import EhAdmin, e_admin
from pedidos import cep as consulta_de_cep
from pedidos.emails import enviar_confirmacao_de_pedido, enviar_mudanca_de_status
from pedidos.frete import cotar
from pedidos.models import Pedido
from pedidos.serializers import (
    AlteracaoStatusSerializer,
    CheckoutSerializer,
    CotacaoFreteSerializer,
    EnderecoConsultadoSerializer,
    OpcaoFreteSerializer,
    PedidoSerializer,
)


class ProvedorIndisponivel(APIException):
    """Serviço externo fora do ar. O cliente não vê nada além disso."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Consulta indisponível no momento. Tente de novo em instantes.'
    default_code = 'provedor_indisponivel'


class CheckoutView(generics.GenericAPIView):
    """Fecha o carrinho e devolve o pedido."""

    serializer_class = CheckoutSerializer
    permission_classes = (permissions.IsAuthenticated,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'pedido'

    @extend_schema(responses={201: PedidoSerializer})
    def post(self, request: Request) -> Response:
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        try:
            pedido = Pedido.objects.fechar_carrinho(
                usuario=request.user,
                endereco=entrada.validated_data['endereco'],
                servico=entrada.validated_data['servico'],
            )
        except ErroDeValidacaoDoModelo as erro:
            raise ValidationError(serializers.as_serializer_error(erro)) from erro

        # O e-mail sai só depois do commit: SMTP fora do ar não desfaz a compra.
        transaction.on_commit(lambda: enviar_confirmacao_de_pedido(pedido))

        return Response(PedidoSerializer(pedido).data, status=status.HTTP_201_CREATED)


class PedidoViewSet(viewsets.ReadOnlyModelViewSet):
    """Pedidos.

    O cliente enxerga os seus; admin enxerga todos, que é a política
    administrativa que o projeto já usa no catálogo.
    """

    serializer_class = PedidoSerializer
    permission_classes = (permissions.IsAuthenticated,)
    lookup_field = 'numero'
    # Só aponta o modelo para o gerador do esquema, que não tem conta para
    # passar no filtro. Quem responde de verdade é o `get_queryset`.
    queryset = Pedido.objects.none()

    def get_queryset(self) -> QuerySet[Pedido]:
        pedidos = Pedido.objects.select_related('entrega', 'usuario').prefetch_related('itens')
        if e_admin(self.request.user):
            return pedidos
        return pedidos.filter(usuario=self.request.user)

    @extend_schema(request=AlteracaoStatusSerializer, responses=PedidoSerializer)
    @action(
        detail=True,
        methods=('post',),
        url_path='status',
        url_name='status',
        permission_classes=(EhAdmin,),
    )
    def alterar_status(self, request: Request, numero: str | None = None) -> Response:
        """Move o pedido no fluxo. Só admin, e só transição prevista."""
        pedido = self.get_object()
        entrada = AlteracaoStatusSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        try:
            pedido.alterar_status(entrada.validated_data['status'])
        except ErroDeValidacaoDoModelo as erro:
            raise ValidationError(serializers.as_serializer_error(erro)) from erro

        registrar(
            request.user,
            'pedido_status_alterado',
            alvo=f'pedido:{pedido.numero}',
            detalhes=pedido.status,
        )
        transaction.on_commit(lambda: enviar_mudanca_de_status(pedido))

        return Response(PedidoSerializer(pedido).data)

    @extend_schema(request=None, responses=PedidoSerializer)
    @action(detail=True, methods=('post',), url_path='cancelar', url_name='cancelar')
    def cancelar(self, request: Request, numero: str | None = None) -> Response:
        """Cancela o próprio pedido enquanto ele espera pagamento.

        A consulta é a da própria conta mesmo para admin: pedido de outra
        pessoa não existe aqui, e a resposta é 404. A loja cancela pelo fluxo
        de status, que tem trilha de auditoria.
        """
        pedido = generics.get_object_or_404(
            self.get_queryset().filter(usuario=request.user), numero=numero
        )

        try:
            pedido.cancelar_pelo_cliente()
        except ErroDeValidacaoDoModelo as erro:
            raise ValidationError(serializers.as_serializer_error(erro)) from erro

        transaction.on_commit(lambda: enviar_mudanca_de_status(pedido))

        return Response(PedidoSerializer(pedido).data)


class CotacaoFreteView(generics.GenericAPIView):
    """Opções de frete para o carrinho da conta e um endereço dela."""

    serializer_class = CotacaoFreteSerializer
    permission_classes = (permissions.IsAuthenticated,)
    # A resposta é a lista inteira de opções, sem página. Sem isto o esquema
    # herdaria a paginação padrão e anunciaria uma página que não existe.
    pagination_class = None

    @extend_schema(responses=OpcaoFreteSerializer(many=True))
    def post(self, request: Request) -> Response:
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        carrinho = Carrinho.objects.do_usuario(request.user)
        quantidade = sum(carrinho.itens.values_list('quantidade', flat=True))
        if not quantidade:
            raise ValidationError({'carrinho': 'Carrinho vazio.'})

        try:
            opcoes = cotar(entrada.validated_data['endereco'].uf, quantidade)
        except ErroDeValidacaoDoModelo as erro:
            raise ValidationError(serializers.as_serializer_error(erro)) from erro

        return Response(OpcaoFreteSerializer(opcoes, many=True).data)


class ConsultaCepView(generics.GenericAPIView):
    """Consulta de CEP feita pelo backend, com limite por minuto."""

    serializer_class = EnderecoConsultadoSerializer
    permission_classes = (permissions.IsAuthenticated,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'consulta'

    def get(self, request: Request, cep: str) -> Response:
        try:
            endereco = consulta_de_cep.consultar(cep)
        except consulta_de_cep.CepInvalido as erro:
            raise ValidationError({'cep': 'CEP não encontrado.'}) from erro
        except consulta_de_cep.ConsultaIndisponivel as erro:
            raise ProvedorIndisponivel from erro

        return Response(self.get_serializer(endereco).data)
