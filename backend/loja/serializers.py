"""Serializers do catálogo."""

from __future__ import annotations

import copy

from django.core.exceptions import ValidationError as ErroDeValidacaoDoModelo
from rest_framework import serializers

from loja.models import Categoria, Produto, Subtipo

#: Campos visíveis ao cliente final. Estoque, status e datas ficam de fora.
CAMPOS_CATALOGO = (
    'id',
    'sku',
    'nome',
    'descricao',
    'marca',
    'categoria',
    'subtipo',
    'preco',
    'em_estoque',
    'puffs',
    'volume_ml',
    'nicotina_mg_ml',
)


class SubtipoSerializer(serializers.ModelSerializer):
    """Subtipos do catálogo, usados como filtro."""

    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)

    class Meta:
        model = Subtipo
        fields = ('slug', 'nome', 'categoria', 'categoria_display')
        read_only_fields = ('slug', 'nome', 'categoria')


class ProdutoSerializer(serializers.ModelSerializer):
    """Catálogo público: somente leitura."""

    categoria = serializers.ChoiceField(
        choices=Categoria.choices, source='subtipo.categoria', read_only=True
    )
    subtipo = serializers.SlugRelatedField(slug_field='slug', read_only=True)
    em_estoque = serializers.BooleanField(read_only=True)

    class Meta:
        model = Produto
        fields = CAMPOS_CATALOGO
        read_only_fields = (
            'id',
            'sku',
            'nome',
            'descricao',
            'marca',
            'preco',
            'puffs',
            'volume_ml',
            'nicotina_mg_ml',
        )


class ProdutoGestaoSerializer(ProdutoSerializer):
    """Cadastro do produto pela equipe da loja.

    `estoque` continua somente leitura aqui: ele muda apenas pelo endpoint de
    ajuste, que registra a operação em uma única consulta atômica.
    """

    subtipo = serializers.SlugRelatedField(slug_field='slug', queryset=Subtipo.objects.all())

    class Meta(ProdutoSerializer.Meta):
        fields = CAMPOS_CATALOGO + ('estoque', 'ativo', 'criado_em', 'atualizado_em')
        read_only_fields = ('id', 'estoque', 'criado_em', 'atualizado_em')

    def validate(self, attrs: dict) -> dict:
        """Aplica as validações do modelo, que são a regra de domínio."""
        produto = self._projetar(attrs)
        try:
            # A unicidade fica com o DRF, que devolve a mensagem por campo.
            produto.full_clean(validate_unique=False)
        except ErroDeValidacaoDoModelo as erro:
            raise serializers.ValidationError(serializers.as_serializer_error(erro)) from erro
        return attrs

    def _projetar(self, attrs: dict) -> Produto:
        """Devolve o produto como ele ficaria se os dados fossem salvos."""
        if self.instance is None:
            return Produto(**attrs)

        produto = copy.copy(self.instance)
        for campo, valor in attrs.items():
            setattr(produto, campo, valor)
        return produto


class AjusteEstoqueSerializer(serializers.Serializer):
    """Entrada do ajuste de estoque: positivo repõe, negativo dá baixa."""

    delta = serializers.IntegerField(min_value=-100_000, max_value=100_000)

    def validate_delta(self, valor: int) -> int:
        if valor == 0:
            raise serializers.ValidationError('Informe um valor diferente de zero.')
        return valor
