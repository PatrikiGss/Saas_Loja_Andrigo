"""Carga inicial com os subtipos mais comuns de cada categoria."""
from django.db import migrations

#: (categoria, slug, nome). As categorias são escritas literalmente para que a
#: migração não dependa do código da app.
SUBTIPOS = (
    ('pod_descartavel', 'descartavel-caneta', 'Caneta'),
    ('pod_descartavel', 'descartavel-box', 'Box'),
    ('pod_descartavel', 'descartavel-com-display', 'Com display'),
    ('pod_recarregavel', 'pod-system-aberto', 'Pod system aberto'),
    ('pod_recarregavel', 'pod-system-fechado', 'Pod system fechado'),
    ('pod_recarregavel', 'pod-cartucho', 'Cartucho de reposição'),
    ('pod_recarregavel', 'pod-bateria', 'Bateria'),
    ('vape', 'vape-kit-mod', 'Kit mod'),
    ('vape', 'vape-atomizador', 'Atomizador'),
    ('vape', 'vape-resistencia', 'Resistência'),
    ('vape', 'vape-bateria', 'Bateria externa'),
    ('essencia', 'essencia-freebase', 'Freebase'),
    ('essencia', 'essencia-nic-salt', 'Nic salt'),
    ('essencia', 'essencia-sem-nicotina', 'Sem nicotina'),
    ('vaporizador_ervas', 'vaporizador-portatil', 'Portátil'),
    ('vaporizador_ervas', 'vaporizador-de-mesa', 'De mesa'),
    ('vaporizador_ervas', 'vaporizador-peca', 'Peça de reposição'),
)


def criar_subtipos(apps, schema_editor):
    Subtipo = apps.get_model('loja', 'Subtipo')
    Subtipo.objects.bulk_create(
        [Subtipo(categoria=categoria, slug=slug, nome=nome) for categoria, slug, nome in SUBTIPOS],
        ignore_conflicts=True,
    )


def remover_subtipos(apps, schema_editor):
    Subtipo = apps.get_model('loja', 'Subtipo')
    Subtipo.objects.filter(slug__in=[slug for _, slug, _ in SUBTIPOS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('loja', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(criar_subtipos, remover_subtipos),
    ]
