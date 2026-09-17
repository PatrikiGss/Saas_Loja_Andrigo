"""Modelagem do catálogo de produtos da loja."""
from __future__ import annotations

import uuid
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone


class Categoria(models.TextChoices):
    """Grupos de produtos vendidos pela loja."""

    POD_DESCARTAVEL = 'pod_descartavel', 'Pod descartável'
    POD_RECARREGAVEL = 'pod_recarregavel', 'Pod recarregável'
    VAPE = 'vape', 'Vape'
    ESSENCIA = 'essencia', 'Essência'
    VAPORIZADOR_ERVAS = 'vaporizador_ervas', 'Vaporizador de ervas'


#: Campos de especificação que o catálogo conhece.
ESPECIFICACOES = ('puffs', 'volume_ml', 'nicotina_mg_ml')

#: Especificações aplicáveis a cada categoria: são obrigatórias na categoria em
#: que aparecem e precisam ficar vazias nas demais. É a fonte única das regras
#: por tipo de produto, usada pelo modelo e pelos serializers.
ESPECIFICACOES_POR_CATEGORIA: dict[str, tuple[str, ...]] = {
    Categoria.POD_DESCARTAVEL: ('puffs', 'nicotina_mg_ml'),
    Categoria.POD_RECARREGAVEL: (),
    Categoria.VAPE: (),
    Categoria.ESSENCIA: ('volume_ml', 'nicotina_mg_ml'),
    Categoria.VAPORIZADOR_ERVAS: (),
}


class Subtipo(models.Model):
    """Subtipo dentro de uma categoria, por exemplo 'nic salt' em essências.

    A categoria vive aqui e não no produto: assim um produto não pode divergir
    da categoria do seu subtipo, e novos subtipos entram como dado, sem
    alteração de esquema.
    """

    nome = models.CharField(max_length=60)
    slug = models.SlugField(max_length=60, unique=True)
    categoria = models.CharField(max_length=20, choices=Categoria.choices)

    class Meta:
        ordering = ('categoria', 'nome')
        constraints = (
            models.UniqueConstraint(
                fields=('categoria', 'nome'),
                name='subtipo_nome_unico_na_categoria',
            ),
        )

    def __str__(self) -> str:
        return f'{self.get_categoria_display()} / {self.nome}'


class Produto(models.Model):
    """Item do catálogo.

    O identificador é UUID para que a API não exponha uma sequência de ids
    adivinháveis. Preço e estoque têm restrições no banco, e as regras por
    categoria são validadas em `clean`.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sku = models.CharField(
        max_length=32,
        unique=True,
        validators=(
            RegexValidator(
                r'^[A-Z0-9][A-Z0-9-]{3,31}$',
                'Use letras maiúsculas, números e hífen, com no mínimo 4 caracteres.',
            ),
        ),
    )
    nome = models.CharField(max_length=120)
    descricao = models.TextField(max_length=2000, blank=True)
    marca = models.CharField(max_length=60)
    subtipo = models.ForeignKey(Subtipo, on_delete=models.PROTECT, related_name='produtos')
    preco = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=(MinValueValidator(Decimal('0.01')),),
    )
    estoque = models.PositiveIntegerField(default=0)
    ativo = models.BooleanField(default=True)

    puffs = models.PositiveIntegerField(null=True, blank=True, validators=(MinValueValidator(1),))
    volume_ml = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        validators=(MinValueValidator(Decimal('0.01')),),
    )
    nicotina_mg_ml = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        null=True,
        blank=True,
        validators=(MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('70'))),
    )

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('nome',)
        indexes = (models.Index(fields=('ativo', 'nome'), name='produto_ativo_nome_idx'),)
        constraints = (
            models.CheckConstraint(
                condition=models.Q(preco__gt=0),
                name='produto_preco_positivo',
            ),
            models.CheckConstraint(
                condition=models.Q(puffs__isnull=True) | models.Q(puffs__gt=0),
                name='produto_puffs_positivo',
            ),
            models.CheckConstraint(
                condition=models.Q(volume_ml__isnull=True) | models.Q(volume_ml__gt=0),
                name='produto_volume_positivo',
            ),
            models.CheckConstraint(
                condition=models.Q(nicotina_mg_ml__isnull=True)
                | models.Q(nicotina_mg_ml__gte=0, nicotina_mg_ml__lte=70),
                name='produto_nicotina_na_faixa',
            ),
        )

    def __str__(self) -> str:
        return f'{self.nome} ({self.sku})'

    @property
    def em_estoque(self) -> bool:
        return self.estoque > 0

    def clean(self) -> None:
        """Valida as especificações contra a categoria do subtipo."""
        if self.subtipo_id is None:
            return

        aplicaveis = ESPECIFICACOES_POR_CATEGORIA.get(self.subtipo.categoria, ())
        erros = {}
        for campo in ESPECIFICACOES:
            valor = getattr(self, campo)
            if campo in aplicaveis and valor is None:
                erros[campo] = 'Obrigatório para esta categoria.'
            elif campo not in aplicaveis and valor is not None:
                erros[campo] = 'Não se aplica a esta categoria.'

        if erros:
            raise ValidationError(erros)

    def ajustar_estoque(self, delta: int) -> int:
        """Soma `delta` ao estoque e devolve o novo valor.

        A conta é feita pelo banco em uma única consulta condicional, então
        duas baixas simultâneas não conseguem derrubar o estoque abaixo de
        zero. `delta` negativo dá baixa.
        """
        atualizados = Produto.objects.filter(pk=self.pk, estoque__gte=max(0, -delta)).update(
            estoque=models.F('estoque') + delta,
            atualizado_em=timezone.now(),
        )
        if not atualizados:
            raise ValidationError({'delta': 'Estoque insuficiente para a baixa solicitada.'})

        self.refresh_from_db(fields=('estoque', 'atualizado_em'))
        return self.estoque
