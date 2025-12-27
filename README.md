# SocialHub

SocialHub is a web app for building, exploring, and managing dashboards with AI-assisted generation, user collaboration, and admin tooling. The repo includes a Vite + React frontend and an Express-based backend.

## Features
- Authentication: sign up, sign in, password reset, profile updates
- Dashboard management: create, rename, favorites, share, templates
- Dashboard detail: records, widgets, charts, access control
- Explore public dashboards
- AI chat assistant
- Reviews/feedback collection
- Admin portal for users, dashboards, notifications, and activity

## Tech Stack
- Frontend: React 18, Vite, Tailwind, Radix UI, Recharts
- Backend: Node.js, Express, MongoDB/Mongoose, PostgreSQL (pg)
- E2E tests: Playwright

## Project Structure
- `src/` Frontend application
- `backend/src/` Backend server
- `shared/` Shared types/utilities
- `tests/` Playwright E2E tests
- `playwright.config.ts` Test config

## Setup
### Prerequisites
- Node.js 18+ (recommended)
- npm

### Install
Frontend:
```bash
npm install
```

Backend:
```bash
cd backend
npm install
```

### Environment
Frontend:
- Copy `.env.example` to `.env`
- Set `VITE_API_URL` to your backend URL

Backend:
- Configure `backend/.env` with database credentials, JWT secret, mail, and OpenAI keys as needed

## Run
Frontend:
```bash
npm run dev
```

Backend:
```bash
cd backend
npm run dev
```

## Build
```bash
npm run build
```

## Tests
Run E2E tests:
```bash
npx playwright test
```

Real API tests (requires backend running):
```bash
# PowerShell
$env:E2E_REAL_API="1"; $env:API_URL="http://127.0.0.1:4000"; npx playwright test
```

## Diagrams
- `diagram.mmd`
- `CLASS_DIAGRAM_PLANTUML.md`
