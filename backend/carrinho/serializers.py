"""Serializers do carrinho."""

from __future__ import annotations

import copy

from rest_framework import serializers

from carrinho.models import QUANTIDADE_MAXIMA, Carrinho, ItemCarrinho
from loja.models import Categoria, Produto
from painel.erros import recusa_do_modelo


class ProdutoNoCarrinhoSerializer(serializers.ModelSerializer):
    """O que o front precisa mostrar do produto dentro do carrinho.

    `disponivel` resume o estado atual sem expor o estoque, que não é público
    no catálogo. `categoria` dá a cor do produto, como no catálogo.
    """

    categoria = serializers.ChoiceField(
        choices=Categoria.choices, source='subtipo.categoria', read_only=True
    )
    disponivel = serializers.SerializerMethodField()

    class Meta:
        model = Produto
        fields = ('id', 'sku', 'nome', 'preco', 'categoria', 'disponivel')

    def get_disponivel(self, produto: Produto) -> bool:
        return produto.ativo and produto.em_estoque


class ItemCarrinhoSerializer(serializers.ModelSerializer):
    """Leitura do item: preço e subtotal vêm do servidor."""

    produto = ProdutoNoCarrinhoSerializer(read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ItemCarrinho
        fields = ('id', 'produto', 'quantidade', 'subtotal')
        read_only_fields = ('id', 'quantidade')


class CarrinhoSerializer(serializers.ModelSerializer):
    """O carrinho inteiro. O dono não aparece: quem pergunta já é o dono."""

    itens = ItemCarrinhoSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Carrinho
        fields = ('itens', 'total')


class AdicionarItemSerializer(serializers.Serializer):
    """Entrada da inclusão: só produto e quantidade.

    O produto é procurado entre os ativos, então um id inativo ou inexistente
    cai na mesma resposta e não conta o que existe no catálogo.
    """

    produto = serializers.PrimaryKeyRelatedField(queryset=Produto.objects.filter(ativo=True))
    quantidade = serializers.IntegerField(min_value=1, max_value=QUANTIDADE_MAXIMA)


class QuantidadeItemSerializer(serializers.ModelSerializer):
    """Alteração do item: a quantidade é o único campo do cliente."""

    class Meta:
        model = ItemCarrinho
        fields = ('quantidade',)

    def validate(self, attrs: dict) -> dict:
        """Delega as regras de estoque e disponibilidade ao modelo."""
        item = copy.copy(self.instance)
        item.quantidade = attrs.get('quantidade', item.quantidade)
        with recusa_do_modelo():
            item.full_clean(validate_unique=False)
        return attrs

    def to_representation(self, instance: ItemCarrinho) -> dict:
        return ItemCarrinhoSerializer(instance, context=self.context).data
