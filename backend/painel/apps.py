from django.apps import AppConfig


class PainelConfig(AppConfig):
    name = 'painel'

    def ready(self) -> None:
        from painel import signals  # noqa: F401  (registra a criação do perfil)
