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

Os tipos da API no frontend não são escritos à mão: saem do esquema OpenAPI
que o backend gera dos próprios serializers (veja
[Esquema da API](#esquema-da-api-e-tipos-gerados)). Um serializer que mude
quebra a compilação do frontend, e não a tela de alguém.

As respostas também são conferidas quando chegam, porque a tipagem some na
compilação e o frontend publicado pode ser mais velho que a API. A conferência
olha a forma — se a resposta é objeto, se traz as chaves de que aquela tela
depende, se a página tem `count` e `results` — e transforma o desencontro num
erro comum, com a mesma faixa de aviso de sempre.

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

Cadastro, recuperação de senha, confirmação de pedido e cada mudança de
status do pedido entram numa fila no banco em vez de segurar a requisição no
SMTP. Em desenvolvimento o e-mail sai no console; para vê-lo,
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

O relatório falha abaixo de 90%. Hoje está em 97%, com 346 testes — boa parte
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

São 441 testes, com cobertura em torno de 97% de linhas — o mesmo patamar do
backend. O relatório falha abaixo dos limites configurados, que ficam um pouco
abaixo do alcançado para não quebrar o CI a cada linha nova.

Entre eles há uma **auditoria de acessibilidade com o axe** rodando sobre as
telas e os componentes de formulário: campo sem rótulo, botão sem nome
acessível, cabeçalho fora de ordem e `aria-*` apontando para o nada reprovam o
teste. A regra de contraste fica desligada porque o jsdom não pinta nada — o
contraste da paleta foi decidido nos tokens.

Tipos e build:

```bash
cd frontend && npm run verificar-tipos
```

```bash
cd frontend && npm run build
```

### Ponta a ponta

Os testes acima trocam a API por dublês. Os de ponta a ponta, com o
Playwright, põem o frontend de verdade contra o backend de verdade num
navegador: entrar, continuar dentro depois de recarregar, sair, errar a senha,
comprar do catálogo até o pedido registrado — conferindo que o total que a
tela estima é o que o servidor cobra —, cancelar o pedido que espera
pagamento, e a gestão movendo o pedido só pelos status que o servidor aceita.

Na primeira vez, baixe o navegador:

```bash
cd frontend && npx playwright install chromium
```

Depois, com o venv ativado:

```bash
cd frontend && npm run e2e
```

O Playwright sobe o backend com `manage.py testserver`, que cria um banco de
teste do zero e carrega a conta admin de `backend/configs/fixture_e2e.json`,
e sobe o frontend com o Vite. **A porta 8000 precisa estar livre**: a suíte se
recusa a rodar contra o servidor de desenvolvimento, que criaria contas e
pedidos no seu banco. Cada teste cria a própria conta, ativada pela API de
gestão, porque o e-mail de ativação não sai nos testes.

Duas variáveis opcionais: `E2E_MANAGE` troca o jeito de chamar o `manage.py`
(o padrão é `python manage.py`), e `E2E_NAVEGADOR=msedge` usa o Edge já
instalado em vez de baixar o Chromium.

## Lint e formatação

O **ruff** cuida do backend e o **ESLint** com o **Prettier** cuidam do
frontend. A largura de linha é 100 nos dois lados e as aspas são simples. O
CI recusa código fora do formato, então vale rodar antes de subir.

### Backend

A configuração fica em `backend/ruff.toml`. As migrations ficam de fora,
porque quem as escreve é o Django.

```bash
cd backend && ruff check .
```

```bash
cd backend && ruff format .
```

`ruff check --fix .` corrige sozinho o que é mecânico, como a ordem dos imports
e import sem uso.

### Frontend

A regra fica no ESLint e o formato fica no Prettier. O ESLint não opina sobre
formato, então os dois não brigam.

```bash
cd frontend && npm run lint
```

```bash
cd frontend && npm run formatar
```

`npm run lint:corrigir` aplica as correções automáticas do ESLint, e
`npm run verificar-formato` confere o formato sem mexer nos arquivos, do mesmo
jeito que o CI faz.

O `.gitattributes` da raiz fixa o fim de linha em LF, inclusive no Windows.
Sem ele, o `core.autocrlf` de cada máquina decidia, e o formatador acusava
diferença em arquivo que só tinha mudado o fim de linha.

## Esquema da API e tipos gerados

O backend descreve a própria API em `backend/schema.yml`, gerado pelo
drf-spectacular a partir dos serializers e das views. O frontend gera os tipos
dele em `frontend/src/types/esquema.ts`. Nenhum dos dois arquivos se edita à
mão.

Quando um serializer ou uma view muda, regenere o esquema:

```bash
cd backend && python manage.py spectacular --file schema.yml --validate --fail-on-warn
```

E depois os tipos:

```bash
cd frontend && npm run gerar-tipos
```

A partir daí o `npm run verificar-tipos` aponta cada tela que dependia da
forma antiga. O CI faz os dois passos e recusa o PR em que algum dos arquivos
não bate com o código — o mesmo que já faz com as migrations.

O `--fail-on-warn` recusa view que o gerador não consegue descrever sozinho:
resposta diferente da entrada, view sem serializer, `get_queryset` que depende
da conta. Nesses casos a view ganha um `@extend_schema` dizendo o que devolve.

O esquema traz o valor das opções dos `TextChoices`, não o rótulo. Por isso os
textos de status, de serviço de frete e os nomes das UFs continuam escritos no
frontend — mas indexados pelo tipo gerado, então uma opção nova no backend
quebra a compilação até ganhar texto.

## Integração contínua

Três workflows, todos em push na `main` e em pull request:

- **`backend.yml`** — lint e formatação com o ruff, `manage.py check`,
  `makemigrations --check`, esquema OpenAPI em dia, testes com cobertura
  mínima de 90% e `pip-audit`.
- **`frontend.yml`** — lint com o ESLint, formatação com o Prettier, tipos da
  API em dia, verificação de tipos, testes com cobertura, build e `npm audit`.
- **`e2e.yml`** — os testes ponta a ponta no Chromium. Com falha, o relatório
  do Playwright fica como artefato da execução, com tela, rede e console de
  cada passo.

O Dependabot abre PR semanal de dependência do Python e do npm, e mensal das
GitHub Actions. As ferramentas de build do frontend (Vite, Vitest, vue-tsc)
sobem agrupadas, porque atualizar uma sem as outras costuma quebrar a
compatibilidade entre elas. O ESLint e os plugins dele também sobem juntos, pelo
mesmo motivo.

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
- **Código de rastreio e frete real**, que dependem de transportadora.
- **Verificação de idade, aceite de termos e o par exportar/apagar dados.**

O cliente cancela o próprio pedido só enquanto ele espera pagamento. Depois
de pago, cancelar exige estorno, que depende do gateway: aí quem cancela é a
loja, pelo fluxo de status da gestão.

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
