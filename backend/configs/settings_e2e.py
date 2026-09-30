"""Configuração do servidor que os testes ponta a ponta sobem.

Sobe com `manage.py testserver`, que cria um banco de teste do zero a cada
rodada e carrega a conta admin de `configs/fixture_e2e.json`. O banco de
desenvolvimento nunca é tocado. As migrations rodam inteiras, então os
subtipos iniciais já estão lá.
"""

from configs.settings import *  # noqa: F403
from configs.settings import BASE_DIR, COOKIE_DO_REFRESH, DATABASES, REST_FRAMEWORK

# Em arquivo, e não em memória: em memória o SQLite não aceita conexão de mais
# de uma thread, e o testserver atenderia uma requisição por vez.
DATABASES['default']['TEST'] = {'NAME': BASE_DIR / 'e2e.sqlite3'}

# A mesma troca do settings_test: o hash lento de propósito só atrasaria cada
# cadastro e cada login da suíte.
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# Cada teste cria a própria conta e entra com ela. Com os limites de produção,
# a suíte esbarraria no próprio freio contra força bruta.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    'DEFAULT_THROTTLE_RATES': {'auth': '1000/min', 'consulta': '1000/min', 'pedido': '1000/min'},
}

# O servidor dos testes fala http, como o de desenvolvimento.
SECURE_SSL_REDIRECT = False
COOKIE_DO_REFRESH = {**COOKIE_DO_REFRESH, 'SEGURO': False}
