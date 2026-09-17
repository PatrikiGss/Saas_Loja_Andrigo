"""Cria perfil para as contas que existiam antes da app painel."""
from django.conf import settings
from django.db import migrations


def criar_perfis(apps, schema_editor):
    Perfil = apps.get_model('painel', 'Perfil')
    Usuario = apps.get_model(settings.AUTH_USER_MODEL)
    Perfil.objects.bulk_create(
        [Perfil(usuario=usuario) for usuario in Usuario.objects.filter(perfil__isnull=True)]
    )


class Migration(migrations.Migration):

    dependencies = [
        ('painel', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(criar_perfis, migrations.RunPython.noop),
    ]
