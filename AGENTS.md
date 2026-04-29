# Driver Tracker – Agent & Project Guide

## Project Context (Split Architecture)

- **Frontend**: Next.js App Router (in `frontend/`), TypeScript, Tailwind CSS, NextAuth, PWA, React
- **Backend**: Node.js/Express API (in `backend/`), TypeScript, Prisma, PostgreSQL
- **Primary domains**: driver check-in/check-out, admin operations, superuser configuration, alert notifications
- **Roles**: SUPERUSER, ADMIN, DRIVER

---

## Code Style & Conventions

- **Frontend**: Use role guard helpers from `frontend/src/lib/auth.ts` (`isSuperuser`, `isAdmin`, `isAdminOrSuperuser`) for RBAC logic
- **Backend**: Use role helpers from `backend/lib/auth.ts` (if present)
- **API validation**: Use zod for all route handler validation (frontend: `src/app/api/*`, backend: `backend/routes/`)
- **Provider secrets**: Never store in plaintext; use encrypted settings flow (see `settings-crypto.ts` and `notification-settings.ts` in each service)
- **TypeScript**: Strict mode throughout

---

## Database Changes (Prisma)

When a change touches Prisma schema or DB-dependent behavior, always do all of the following:

1. Update `prisma/schema.prisma`
2. Create or update migration SQL under `prisma/migrations/`
3. Run `npx prisma generate`
4. Apply migrations:
	- Local: `npx prisma migrate dev`
	- Production: `npx prisma migrate deploy`
5. Update relevant `README.md` if setup/run steps changed

---

## UI and API Sync

- If admin/superuser UI forms change, update corresponding API schemas and response types in the same PR
- If a field is added to Prisma models, update select/include projections in both frontend and backend
- For active/inactive logic, always enforce on the server (not UI-only)

---

## Validation Before Completion

- Run lint: `npm run lint` (in both `frontend/` and `backend/`)
- Run build: `npm run build` (in both `frontend/` and `backend/`)
- If schema changed, ensure Prisma client generation succeeds

---

## Deployment and Testing

- See `docs/deployment-coolify.md` for Coolify self-hosted setup
- See `docs/azure-deployment.md` for Azure deployment
- See `docs/docker-local.md` for Docker-only local backend
- Run `npm run lint` and `npm run build` in both services before testing
- Ensure Prisma migrations are applied via `npx prisma migrate deploy` in production

---

## Available Agents

- **Project Maintainer**: `.github/agents/project-maintainer.agent.md` – Oversees full-stack, DB, and deployment
- **Code Reviewer**: `.github/agents/engineering-code-reviewer.md` – Reviews for correctness, maintainability, security
- **Frontend Developer**: `.github/agents/engineering-frontend-developer.md` – Next.js, React, UI implementation
- **Backend Architect**: `.github/agents/engineering-backend-architect.md` – Express API, DB, infrastructure
- **UI Designer**: `.github/agents/design-ui-designer.md` – Visual/UI design
- **UX Architect**: `.github/agents/design-ux-architect.md` – UX flows, accessibility
- **React Frontend Engineer**: `.github/agents/expert-react-frontend-engineer.agent.md` – Advanced React, hooks, performance

---

**Note:**
- All new code should live in `frontend/` or `backend/`.
- `_archive_pre_split/` contains the legacy monolithic app for reference only.
