"""Configuração usada pelos testes.

A única diferença é o algoritmo de senha. O padrão do Django é lento de
propósito, e a suíte cria centenas de contas: com o hasher rápido ela roda em
um terço do tempo, sem mudar nada do que está sendo testado.
"""

from configs.settings import *  # noqa: F401,F403

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# O cliente de teste fala http: sem isso, com DEBUG desligado no CI, toda
# requisição viraria redirecionamento para https.
SECURE_SSL_REDIRECT = False
