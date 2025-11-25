# SocialHub – SaaS Dashboard Builder

Full-stack app: React (Vite) frontend + Node/Express backend + PostgreSQL. Supports email/password auth with email verification, password reset, Google/GitHub OAuth, and AI chat with saved conversation history. Backend exposes APIs for org/data source/dashboard management and AI recommendations.

## Tech Stack
- Frontend: React + Vite + TypeScript, shadcn/ui, lucide-react, Sonner toasts.
- Backend: Node.js, Express, pg, jsonwebtoken, bcryptjs, nodemailer, OpenAI.
- Database: PostgreSQL (uuid-ossp, citext extensions).

## Prerequisites
- Node.js 18+
- PostgreSQL (create DB `socialhub`)
- OpenAI API key (optional for AI features; required for /ai/chat)

## Backend Setup
```bash
cd backend
npm install
# copy or edit backend/.env
npm run start   # or npm run dev for nodemon
```
`backend/.env` (example):
```
DATABASE_URL=postgresql://postgres:123456@localhost:5432/socialhub
PORT=4000
JWT_SECRET=change-me-please
FRONTEND_URL=http://localhost:3000

# SMTP (email verification / reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SECURE=false
SMTP_FROM="SocialHub <your-email@gmail.com>"

# Google OAuth
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxx
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=xxxx
GITHUB_CLIENT_SECRET=xxxx
GITHUB_REDIRECT_URI=http://localhost:4000/auth/github/callback

# OpenAI (for AI chat)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

### Database (pgAdmin/psql)
1) Create DB `socialhub`.
2) Run `backend/db/schema.sql` once (Query Tool in pgAdmin or `psql -f backend/db/schema.sql`). Tables include: users, password/email tokens, organizations, members, data_sources, dashboards, widgets, service_profiles, dashboard_service_bindings, ai_recommendations, ai_conversations, ai_messages.
3) Ensure `DATABASE_URL` matches your DB. Backend `initDb()` also runs the schema if needed.

## Frontend Setup
```bash
npm install
# optional: set API URL
echo "VITE_API_URL=http://localhost:4000" > .env.local
npm run dev -- --host --port 3000
```

## Auth & AI Features
- Email/password register → send 6-digit verification code (SMTP real). Must verify before login.
- Forgot password → send reset code, then set new password.
- OAuth: Google/GitHub login/register; user created if email not seen before.
- AI Chat: `/ai/chat` requires JWT and OPENAI_API_KEY; conversations/messages are stored in DB (`ai_conversations`, `ai_messages`), so history persists.

## Key API Endpoints (JWT required)
- Auth: `/auth/register`, `/auth/verify-email`, `/auth/login`, `/auth/forgot`, `/auth/reset`, `/auth/me`, `/auth/google`, `/auth/github`.
- Org/data/dashboard: `GET/POST /orgs`; `GET/POST /orgs/:orgId/datasources`; `GET/POST /orgs/:orgId/dashboards`; `GET/POST /orgs/:orgId/dashboards/:dashboardId/widgets`; `GET/POST /orgs/:orgId/services`; `GET/POST /orgs/:orgId/dashboards/:dashboardId/services`; `GET/POST /orgs/:orgId/recommendations`.
- AI chat (persisted):
  - `GET /ai/conversations` – list user conversations.
  - `POST /ai/conversations` – create conversation (seed greeting).
  - `GET /ai/conversations/:id/messages` – get history.
  - `POST /ai/conversations/:id/messages` – save user message, call OpenAI, save assistant reply.
  - `DELETE /ai/conversations/:id` – delete conversation.
  - `POST /ai/chat` – simple chat (no persistence) using OpenAI.

### Sample cURL
```bash
# Create org
curl -X POST http://localhost:4000/orgs \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Ops","industry":"SaaS","employeeCount":120}'

# Create data source
curl -X POST http://localhost:4000/orgs/<orgId>/datasources \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Prod Postgres","type":"postgres","config":{"host":"10.0.0.5","db":"warehouse","ssl":true}}'

# AI: create conversation then send message
curl -X POST http://localhost:4000/ai/conversations \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"title":"Dashboard Design Help"}'

curl -X POST http://localhost:4000/ai/conversations/<convoId>/messages \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"message":"Help me design a sales dashboard"}'
```

## Notes
- SMTP must be real (e.g., Gmail + App Password).
- OAuth requires correct redirect URIs matching backend env.
- AI endpoints return fallback text if OpenAI is not configured or fails, but for real answers set `OPENAI_API_KEY` and ensure user is logged in (JWT). 
