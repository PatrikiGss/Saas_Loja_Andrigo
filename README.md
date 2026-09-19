# SaaS Loja do Andrigo

Loja online de pods. Backend em Django e DRF, frontend em Vue, no mesmo
repositório.

```
SaaS-andrigo/
├── backend/     Django + DRF — a API e as regras de negócio
├── frontend/    Vue 3 + TypeScript — a loja e o painel de gestão
└── venv/        ambiente virtual do Python (não versionado)
```

O backend é a autoridade: preço, estoque, frete, total do pedido e permissões
são decididos lá. O frontend apresenta e envia dados, e nunca calcula dinheiro
nem decide quem pode o quê.

## O que você precisa

- **Python 3.12**
- **Node.js 22** (com npm)
- Git

## Clonar

```bash
git clone https://github.com/PatrikiGss/Saas_Loja_Andrigo.git SaaS-andrigo
```

## Backend

Na raiz do repositório:

```bash
python -m venv venv
```

Ative o ambiente com PowerShell:

```bash
venv\Scripts\Activate.ps1
```

Instale as dependências — `requirements-dev.txt` já inclui as de produção:

```bash
pip install -r requirements-dev.txt
```

Crie o arquivo de ambiente a partir do modelo. **Ele não vai para o Git.**

```bash
cp backend/.env.example backend/.env
```

Abra `backend/.env` e troque `SECRET_KEY` por uma chave nova. Para gerar uma:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Prepare o banco (SQLite em desenvolvimento):

```bash
cd backend && python manage.py migrate
```

Suba a API:

```bash
cd backend && python manage.py runserver
```

A API fica em `http://localhost:8000/api/`.

### Conta administrativa

O login da API usa o e-mail como identificador, então o nome de usuário
precisa ser o próprio e-mail — senão a conta existe no Django mas não entra
pela API:

```bash
cd backend && python manage.py createsuperuser --username admin@exemplo.com --email admin@exemplo.com
```

### E-mail

Cadastro e recuperação de senha entram numa fila no banco em vez de segurar a
requisição no SMTP. Em desenvolvimento o e-mail sai no console; para vê-lo,
rode a entrega:

```bash
cd backend && python manage.py enviar_emails
```

Em produção isso precisa rodar de minuto em minuto no agendador do servidor.

## Frontend

Em outro terminal:

```bash
cd frontend && npm install
```

```bash
cd frontend && npm run dev
```

A loja fica em `http://localhost:5173`.

**A porta 5173 não é opcional.** É ela que está em `FRONTEND_URL` e
`CORS_ORIGINS` no backend, e é o endereço que vai nos links de ativação de
conta e de recuperação de senha enviados por e-mail. O Vite recusa subir em
outra porta de propósito, para a incompatibilidade aparecer na hora em vez de
virar um link quebrado no e-mail de alguém.

Se quiser apontar para uma API em outro endereço, copie o modelo e ajuste:

```bash
cp frontend/.env.example frontend/.env
```

## Testes

### Backend

```bash
cd backend && python manage.py test --settings=configs.settings_test
```

O `settings_test` só troca o algoritmo de hash de senha, e a suíte cai de
minutos para segundos. Com cobertura:

```bash
cd backend && coverage run manage.py test --settings=configs.settings_test && coverage report
```

O relatório falha abaixo de 90%. Hoje está em 97%, com 324 testes — boa parte
deles tentativas de ataque: mudar preço no payload, acessar pedido de outra
conta, virar admin, IDOR, mass assignment.

### Frontend

```bash
cd frontend && npm test
```

Com cobertura:

```bash
cd frontend && npm run cobertura
```

São 215 testes. A cobertura está em torno de 61% de linhas, e os limites
configurados são o que a suíte alcança hoje: servem para impedir regressão,
não são meta.

**A lacuna conhecida são as views.** Serviços, stores, composables e
componentes reutilizáveis estão cobertos; as telas que só montam esses pedaços
em boa parte não estão. Subir o número significa escrever teste de view, não
afrouxar a configuração.

Tipos e build:

```bash
cd frontend && npm run verificar-tipos
```

```bash
cd frontend && npm run build
```

## Integração contínua

Dois workflows, ambos em push na `main` e em pull request:

- **`backend.yml`** — `manage.py check`, `makemigrations --check`, testes com
  cobertura mínima de 90% e `pip-audit`.
- **`frontend.yml`** — verificação de tipos, testes com cobertura, build e
  `npm audit`.

O Dependabot abre PR semanal de dependência do Python e do npm, e mensal das
GitHub Actions. As ferramentas de build do frontend (Vite, Vitest, vue-tsc)
sobem agrupadas, porque atualizar uma sem as outras costuma quebrar a
compatibilidade entre elas.

## Sessão e autenticação

O login devolve o access token no corpo e grava o refresh em **cookie
`HttpOnly`**, com caminho restrito a `/api/auth/`. O JavaScript não lê nem
escreve esse cookie: um XSS na loja alcança o access token, que vale 15
minutos, mas não leva embora a sessão de sete dias.

No frontend, o access token vive só em memória. Recarregar a página o perde de
propósito — quem sobrevive é o cookie, e a sessão é retomada pedindo um access
novo ao backend.

`SameSite=Lax` é o que segura CSRF hoje, e isso vale **enquanto front e API
forem o mesmo site** (porta diferente não muda o site). Com o frontend em
outro domínio, esse valor precisa virar `None` e aí CSRF passa a exigir
proteção própria.

## O que ainda não existe

- **Pagamento.** Não há provedor. O pedido é criado e fica em
  `aguardando_pagamento`; `Pedido.registrar_pagamento()` já está pronto,
  idempotente, esperando o webhook. A interface avisa isso em um componente
  só, que é o que sai de cena quando o gateway entrar.
- **Imagem de produto.** O backend não tem o campo. No lugar da foto, o
  produto aparece por cor: a categoria dá o matiz e o SKU dá o tom.
- **Cancelamento pelo cliente**, código de rastreio, frete real com
  transportadora, verificação de idade e aceite de termos.

Endereço e frete estão modelados no formato brasileiro (CEP, UF, tabela por
região) e a moeda está em BRL. Enquanto o país de operação não for definido,
tudo segue esse padrão; a troca é por variável de ambiente no frontend
(`VITE_MOEDA`, `VITE_LOCALE`) e por reescrita do módulo de frete no backend.

## Antes de ir para produção

Gateway de pagamento, `SECRET_KEY` nova, `DEBUG` desligado, HTTPS,
`CORS_ORIGINS` apontando para o domínio real, Postgres no lugar do SQLite,
Redis para o cache compartilhado — sem ele o limite de tentativas conta por
processo e não vale nada com vários workers — e o comando `enviar_emails`
agendado.
