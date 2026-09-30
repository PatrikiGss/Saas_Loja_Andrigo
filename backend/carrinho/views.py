"""Endpoints do carrinho da conta autenticada."""

from __future__ import annotations

from django.core.exceptions import ValidationError as ErroDeValidacaoDoModelo
from django.db.models import Prefetch, QuerySet
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, permissions, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from carrinho.models import Carrinho, ItemCarrinho
from carrinho.serializers import (
    AdicionarItemSerializer,
    CarrinhoSerializer,
    ItemCarrinhoSerializer,
    QuantidadeItemSerializer,
)

#: Itens e produtos em uma consulta só, para a leitura não cair em N+1.
ITENS_COM_PRODUTO = Prefetch('itens', queryset=ItemCarrinho.objects.select_related('produto'))


class CarrinhoView(generics.RetrieveAPIView):
    """Carrinho da conta autenticada, criado no primeiro acesso."""

    serializer_class = CarrinhoSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self) -> Carrinho:
        return Carrinho.objects.prefetch_related(ITENS_COM_PRODUTO).do_usuario(self.request.user)


class ItensCarrinhoView(generics.GenericAPIView):
    """Inclusão de item e limpeza do carrinho."""

    serializer_class = AdicionarItemSerializer
    permission_classes = (permissions.IsAuthenticated,)

    @extend_schema(responses={201: ItemCarrinhoSerializer})
    def post(self, request: Request) -> Response:
        """Adiciona o produto. Produto repetido soma à quantidade do item."""
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        carrinho = Carrinho.objects.do_usuario(request.user)

        try:
            item = carrinho.adicionar(**entrada.validated_data)
        except ErroDeValidacaoDoModelo as erro:
            raise ValidationError(serializers.as_serializer_error(erro)) from erro

        return Response(ItemCarrinhoSerializer(item).data, status=status.HTTP_201_CREATED)

    # O id da operação sairia igual ao da exclusão de um item só.
    @extend_schema(operation_id='carrinho_itens_limpar', responses={204: None})
    def delete(self, request: Request) -> Response:
        """Esvazia o carrinho. O carrinho em si continua existindo."""
        Carrinho.objects.do_usuario(request.user).itens.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    # A alteração recebe só a quantidade, mas devolve o item inteiro.
    put=extend_schema(responses=ItemCarrinhoSerializer),
    patch=extend_schema(responses=ItemCarrinhoSerializer),
)
class ItemCarrinhoView(generics.RetrieveUpdateDestroyAPIView):
    """Item do próprio carrinho.

    A consulta já nasce restrita à conta autenticada: o item de outra pessoa
    não existe aqui, então a resposta é 404 e nada é confirmado sobre ele.
    """

    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self) -> QuerySet[ItemCarrinho]:
        return ItemCarrinho.objects.select_related('produto').filter(
            carrinho__usuario=self.request.user
        )

    def get_serializer_class(self) -> type[serializers.ModelSerializer]:
        if self.request.method in permissions.SAFE_METHODS:
            return ItemCarrinhoSerializer
        return QuantidadeItemSerializer
