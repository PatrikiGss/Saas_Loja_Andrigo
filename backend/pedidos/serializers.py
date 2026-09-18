"""Serializers de pedido, checkout, frete e CEP."""
from __future__ import annotations

from rest_framework import serializers

from painel.models import Endereco
from pedidos.frete import ServicoFrete
from pedidos.models import EnderecoDeEntrega, ItemPedido, Pedido, StatusPedido


class EnderecoDeEntregaSerializer(serializers.ModelSerializer):
    """Endereço como ele estava no dia da compra."""

    class Meta:
        model = EnderecoDeEntrega
        fields = ('cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf')
        read_only_fields = fields


class ItemPedidoSerializer(serializers.ModelSerializer):
    """Linha da compra. Tudo aqui é histórico e não muda mais."""

    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ItemPedido
        fields = ('sku', 'nome', 'preco_unitario', 'quantidade', 'subtotal')
        read_only_fields = fields


class PedidoSerializer(serializers.ModelSerializer):
    """Pedido do cliente. Nada aqui é gravável pela API."""

    itens = ItemPedidoSerializer(many=True, read_only=True)
    entrega = EnderecoDeEntregaSerializer(read_only=True)

    class Meta:
        model = Pedido
        fields = (
            'numero',
            'status',
            'status_pagamento',
            'itens',
            'entrega',
            'servico_frete',
            'prazo_frete_em_dias',
            'subtotal',
            'frete',
            'total',
            'criado_em',
            'pago_em',
        )
        read_only_fields = fields


class CheckoutSerializer(serializers.Serializer):
    """Entrada do checkout: endereço e serviço de frete, nada além disso.

    O endereço é procurado entre os da própria conta, então o id de outra
    pessoa simplesmente não é encontrado.
    """

    endereco = serializers.PrimaryKeyRelatedField(queryset=Endereco.objects.none())
    servico = serializers.ChoiceField(choices=ServicoFrete.choices)

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.fields['endereco'].queryset = Endereco.objects.filter(
            usuario=self.context['request'].user
        )


class CotacaoFreteSerializer(serializers.Serializer):
    """Entrada da cotação: só o destino."""

    endereco = serializers.PrimaryKeyRelatedField(queryset=Endereco.objects.none())

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.fields['endereco'].queryset = Endereco.objects.filter(
            usuario=self.context['request'].user
        )


class OpcaoFreteSerializer(serializers.Serializer):
    """Saída da cotação, como o frontend recebe."""

    servico = serializers.CharField(read_only=True)
    nome = serializers.CharField(read_only=True)
    preco = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    prazo_em_dias = serializers.IntegerField(read_only=True)


class EnderecoConsultadoSerializer(serializers.Serializer):
    """Saída da consulta de CEP."""

    cep = serializers.CharField(read_only=True)
    logradouro = serializers.CharField(read_only=True)
    complemento = serializers.CharField(read_only=True)
    bairro = serializers.CharField(read_only=True)
    cidade = serializers.CharField(read_only=True)
    uf = serializers.CharField(read_only=True)


class AlteracaoStatusSerializer(serializers.Serializer):
    """Entrada da mudança de status, aceita somente de contas admin."""

    status = serializers.ChoiceField(choices=StatusPedido.choices)
