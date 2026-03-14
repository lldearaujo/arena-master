# Arena Master

Aplicação completa para gestão de um dojo / academia:

- **Backend**: API em FastAPI + PostgreSQL (check-in, turmas, alunos, faixas/graduações, usuários).
- **Web (painel)**: React + Vite para o painel do professor/superadmin.
- **App (mobile)**: Expo / React Native para alunos e responsáveis (check-in diário, perfil, etc.).

---

## Estrutura do projeto

- `backend/` – API FastAPI, modelos, migrations Alembic.
- `web/` – painel web (professor / superadmin).
- `app/` – app móvel Expo (aluno / responsável).
- `shared/` – tokens de design compartilhados.
- `.env.example` – exemplo de variáveis de ambiente (NÃO commitar `.env` real).

---

## Requisitos

- **Node.js** 18+ (idealmente LTS).
- **npm** ou **pnpm**.
- **Python** 3.11+.
- **PostgreSQL** acessível (local ou remoto).
- **Expo CLI** (via `npx expo` já é suficiente).

---

## Configuração de ambiente

1. **Copie o `.env.example` para `.env` na raiz do projeto**:

   ```bash
   cp .env.example .env
   ```

2. **Ajuste as variáveis de banco e segurança** no `.env`:

   - `DATABASE_URL` / `POSTGRES_*`
   - `JWT_SECRET` (trocar para um valor forte em produção)
   - `CORS_ORIGINS` (URLs do painel e do app web, se houver)

> O backend lê esse `.env` a partir da raiz do projeto.

---

## Backend (API FastAPI)

### Instalar dependências

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Rodar migrations

```bash
cd backend
python -m alembic upgrade head
```

### Rodar API em desenvolvimento

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Por padrão a API ficará em `http://localhost:8000`.

---

## Painel web (professor / superadmin)

### Instalar dependências

```bash
cd web
npm install
```

### Rodar em desenvolvimento

```bash
cd web
npm run dev
```

O Vite normalmente sobe em `http://localhost:5173`.
Certifique-se de que essa URL está incluída em `CORS_ORIGINS` no `.env`.

---

## App mobile (Expo / React Native)

### Instalar dependências

```bash
cd app
npm install
```

### Rodar em desenvolvimento

```bash
cd app
npx expo start
```

Você pode abrir:

- no **Expo Go** (Android/iOS) via QR Code;
- em **emulador** (Android Studio, Xcode);
- em **web** (`w` no terminal do Expo).

O app está configurado para consumir a API em `http://localhost:8000` (ajuste no arquivo `app/src/api/client.ts` se o backend rodar em outro host/IP).

---

## Funcionalidades principais

### Backend / Regras de negócio

- **Autenticação** (JWT) para usuários:
  - superadmin, admin (professor), aluno, responsável.
- **Dojos e turmas**:
  - cadastro de turmas, capacidade, dias da semana, tipo (regular/KIDS).
  - listagem de turmas do dia (apenas as do dia atual).
- **Check-in**:
  - check-in diário do aluno em uma turma.
  - check-in de filhos (KIDS) feito pelo responsável.
  - cancelamento de check-in.
  - cálculo de vagas restantes por turma.
  - listagem de presenças por turma (com nome, graduação e avatar).
- **Sistema de faixas / graduações**:
  - professor define faixas do dojo (Branca, Azul, Preta, etc.).
  - controle de graus/dans por faixa.
  - cada aluno tem `faixa` + `grau`, e o sistema exibe algo como:
    - `Faixa Branca`, `Faixa Azul 2º grau`, `Faixa Preta 1º dan`.
- **Alunos e responsáveis**:
  - cadastro de alunos a partir do painel.
  - vínculo de responsáveis (guardians) aos alunos.

### Painel web

- Login para **superadmin** e **professor**.
- Gestão de:
  - dojos (superadmin);
  - professores (superadmin);
  - alunos;
  - turmas;
  - faixas / graduações;
  - check-ins (lista de presenças).

### App mobile

- Login do **aluno** ou **responsável**.
- Abas principais:
  - **Minhas turmas** – turmas do aluno, check-in/cancelamento, vagas restantes.
  - **Turma kids** – check-in para filhos (KIDS).
  - **Perfil** – avatar/foto de perfil, papel, graduação atual.
- Tela de **presenças da turma**:
  - ao tocar no card da turma, exibe lista de alunos presentes com:
    - foto de perfil (avatar);
    - nome;
    - graduação.

---

## Scripts úteis

Na raiz do projeto há um `docker-compose.yml` com banco de dados e serviços auxiliares. Ajuste conforme sua necessidade antes de usar.

Para criar um superadmin rapidamente (exemplo):

```bash
cd backend
python scripts/create_superadmin.py
```

> Confira o script e adapte usuário/senha antes de rodar em ambiente real.

---

## Convenções de desenvolvimento

- **Backend**: FastAPI + SQLAlchemy async, Alembic para migrations.
- **Web/App**:
  - React / Expo com `@tanstack/react-query` para fetching/cache.
  - Estado de autenticação com Zustand.
  - Tokens de design compartilhados em `shared/design-tokens.ts`.

Recomenda-se criar branches de funcionalidade e abrir PRs no GitHub para evoluções maiores.

