"""Endpoints do catálogo."""

from __future__ import annotations

from django.core.exceptions import ValidationError as ErroDeValidacaoDoModelo
from django.db.models import ProtectedError, QuerySet
from drf_spectacular.utils import (
    OpenApiParameter,
    PolymorphicProxySerializer,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import filters, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from loja.models import Categoria, Produto, Subtipo
from loja.serializers import (
    AjusteEstoqueSerializer,
    ProdutoGestaoSerializer,
    ProdutoSerializer,
    SubtipoSerializer,
)
from painel.auditoria import registrar
from painel.permissions import LeituraPublicaEscritaAdmin, e_admin

#: Por onde o catálogo pode ser ordenado. O filtro e o esquema leem daqui.
CAMPOS_DE_ORDENACAO = ('nome', 'preco', 'criado_em')

#: O que `?ordering=` aceita: cada campo, crescente ou com `-` na frente.
ORDENACOES = [f'{sentido}{campo}' for campo in CAMPOS_DE_ORDENACAO for sentido in ('', '-')]


class ProdutoEmUso(APIException):
    """Produto referenciado por outro registro, como um item de carrinho."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Produto em uso por outros registros. Desative em vez de excluir.'
    default_code = 'produto_em_uso'


class SubtipoViewSet(viewsets.ReadOnlyModelViewSet):
    """Subtipos disponíveis, para montar os filtros do catálogo."""

    queryset = Subtipo.objects.all()
    serializer_class = SubtipoSerializer
    permission_classes = (permissions.AllowAny,)
    lookup_field = 'slug'


def _produto_conforme_quem_pergunta(many: bool = False) -> PolymorphicProxySerializer:
    """O que a leitura devolve: `Produto` ao público, `ProdutoGestao` à equipe.

    O esquema é gerado sem conta nenhuma, então sozinho ele só enxergaria o
    lado público.
    """
    return PolymorphicProxySerializer(
        component_name='ProdutoConformeQuemPergunta',
        serializers=[ProdutoSerializer, ProdutoGestaoSerializer],
        resource_type_field_name=None,
        many=many,
    )


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter('categoria', str, enum=Categoria.values),
            OpenApiParameter('subtipo', str, description='Slug do subtipo.'),
            OpenApiParameter('ordering', str, enum=ORDENACOES),
        ],
        responses=_produto_conforme_quem_pergunta(many=True),
    ),
    retrieve=extend_schema(responses=_produto_conforme_quem_pergunta()),
    # Escrever é só da equipe, e a equipe fala pelo serializer de gestão.
    create=extend_schema(request=ProdutoGestaoSerializer, responses=ProdutoGestaoSerializer),
    update=extend_schema(request=ProdutoGestaoSerializer, responses=ProdutoGestaoSerializer),
    partial_update=extend_schema(
        request=ProdutoGestaoSerializer, responses=ProdutoGestaoSerializer
    ),
)
class ProdutoViewSet(viewsets.ModelViewSet):
    """Catálogo de produtos.

    O cliente lê os produtos ativos com os campos públicos; a equipe lê o
    catálogo inteiro e cadastra. O estoque tem endpoint próprio.
    """

    permission_classes = (LeituraPublicaEscritaAdmin,)
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ('nome', 'marca', 'sku')
    ordering_fields = CAMPOS_DE_ORDENACAO
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

    def perform_create(self, serializer: serializers.ModelSerializer) -> None:
        produto = serializer.save()
        registrar(self.request.user, 'produto_criado', alvo=f'produto:{produto.sku}')

    def perform_update(self, serializer: serializers.ModelSerializer) -> None:
        produto = serializer.save()
        registrar(
            self.request.user,
            'produto_alterado',
            alvo=f'produto:{produto.sku}',
            detalhes=f'preco={produto.preco} ativo={produto.ativo}',
        )

    def perform_destroy(self, instance: Produto) -> None:
        """Só apaga produto sem histórico.

        Quem depende do produto aponta para ele com `PROTECT`, então o banco
        recusa a exclusão e a resposta vira 409. Tirar do catálogo é
        `ativo=False`, que preserva o registro.
        """
        try:
            instance.delete()
        except ProtectedError as erro:
            raise ProdutoEmUso() from erro

        registrar(self.request.user, 'produto_excluido', alvo=f'produto:{instance.sku}')

    @extend_schema(
        request=AjusteEstoqueSerializer,
        responses=inline_serializer('EstoqueAjustado', {'estoque': serializers.IntegerField()}),
    )
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

        registrar(
            request.user,
            'estoque_ajustado',
            alvo=f'produto:{produto.sku}',
            detalhes=f'delta={entrada.validated_data["delta"]} estoque={estoque}',
        )

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
