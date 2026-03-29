# Driver Tracker

## Project Context

- Stack: Next.js App Router, TypeScript, Prisma, NextAuth, Tailwind CSS, PostgreSQL.
- Primary domains: driver check-in/check-out, admin operations, superuser configuration, and alert notifications.
- Roles: SUPERUSER, ADMIN, DRIVER.

## Code Style

- Reuse role guard helpers from `src/lib/auth.ts` (`isSuperuser`, `isAdmin`, `isAdminOrSuperuser`) instead of inline role checks.
- Keep API validation strict with zod in route handlers.
- Preserve existing API patterns in `src/app/api/*` route.ts files.
- Never store provider secrets in plaintext columns; use encrypted settings flow in `src/lib/settings-crypto.ts` and `src/lib/notification-settings.ts`.
- Use TypeScript strictly throughout.

## Database Changes

When a change touches Prisma schema or DB-dependent behavior, always do all of the following:

1. Update `prisma/schema.prisma`.
2. Create or update migration SQL under `prisma/migrations`.
3. Run `npx prisma generate`.
4. Apply migrations (`npx prisma migrate dev` in local feature work, `npx prisma migrate deploy` for deployment/testing environments).
5. Update README.md if developer/operator steps changed.

## UI and API Sync

- If admin/superuser UI forms change, update corresponding API schemas and response types in the same PR.
- If a field is added to Prisma models, update select/include projections where needed.
- For active/inactive behavior, enforce server-side checks (not UI-only).

## Validation Before Completion

- Run lint: `npm run lint`.
- Run build: `npm run build`.
- If schema changed, ensure Prisma client generation succeeds.

## Available Agents

- **Project Maintainer**: `.github/agents/project-maintainer.agent.md`
- **Code Reviewer**: `.github/agents/engineering-code-reviewer.md`
- **Frontend Developer**: `.github/agents/engineering-frontend-developer.md`
- **Backend Architect**: `.github/agents/engineering-backend-architect.md`
- **UI Designer**: `.github/agents/design-ui-designer.md`
- **UX Architect**: `.github/agents/design-ux-architect.md`
- **React Frontend Engineer**: `.github/agents/expert-react-frontend-engineer.agent.md`
