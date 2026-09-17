"""Endpoints do catálogo."""
from __future__ import annotations

from django.core.exceptions import ValidationError as ErroDeValidacaoDoModelo
from django.db.models import QuerySet
from rest_framework import filters, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from loja.models import Categoria, Produto, Subtipo
from loja.serializers import (
    AjusteEstoqueSerializer,
    ProdutoGestaoSerializer,
    ProdutoSerializer,
    SubtipoSerializer,
)
from painel.permissions import LeituraPublicaEscritaAdmin, e_admin


class SubtipoViewSet(viewsets.ReadOnlyModelViewSet):
    """Subtipos disponíveis, para montar os filtros do catálogo."""

    queryset = Subtipo.objects.all()
    serializer_class = SubtipoSerializer
    permission_classes = (permissions.AllowAny,)
    lookup_field = 'slug'


class ProdutoViewSet(viewsets.ModelViewSet):
    """Catálogo de produtos.

    O cliente lê os produtos ativos com os campos públicos; a equipe lê o
    catálogo inteiro e cadastra. O estoque tem endpoint próprio.
    """

    permission_classes = (LeituraPublicaEscritaAdmin,)
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ('nome', 'marca', 'sku')
    ordering_fields = ('nome', 'preco', 'criado_em')
    ordering = ('nome',)

    def get_queryset(self) -> QuerySet[Produto]:
        produtos = Produto.objects.select_related('subtipo')
        if not e_admin(self.request.user):
            produtos = produtos.filter(ativo=True)
        return self._filtrar(produtos)

    def get_serializer_class(self) -> type[serializers.ModelSerializer]:
        if e_admin(self.request.user):
            return ProdutoGestaoSerializer
        return ProdutoSerializer

    @action(detail=True, methods=('post',), url_path='estoque', url_name='estoque')
    def ajustar_estoque(self, request: Request, pk: str | None = None) -> Response:
        """Repõe ou dá baixa no estoque do produto."""
        produto = self.get_object()
        entrada = AjusteEstoqueSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        try:
            estoque = produto.ajustar_estoque(entrada.validated_data['delta'])
        except ErroDeValidacaoDoModelo as erro:
            raise ValidationError(serializers.as_serializer_error(erro)) from erro

        return Response({'estoque': estoque}, status=status.HTTP_200_OK)

    def _filtrar(self, produtos: QuerySet[Produto]) -> QuerySet[Produto]:
        """Filtra por categoria e subtipo, recusando valores desconhecidos."""
        categoria = self.request.query_params.get('categoria')
        if categoria:
            if categoria not in Categoria.values:
                raise ValidationError({'categoria': 'Categoria inválida.'})
            produtos = produtos.filter(subtipo__categoria=categoria)

        subtipo = self.request.query_params.get('subtipo')
        if subtipo:
            produtos = produtos.filter(subtipo__slug=subtipo)

        return produtos
