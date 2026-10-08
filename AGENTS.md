# Repository Guidelines

## Project Structure & Module Organization

iRent Semarang is a planning workspace for an iPhone/accessory rental website and admin PWA. `PRD.md` is authoritative for requirements and technical choices; section 19 lists unresolved decisions. Source, manifests, and tests have not been scaffolded.

- Planned backend: `backend/src/modules/<feature>/`, `src/auth/`, `src/prisma/`, and `prisma/{schema.prisma,migrations/}`.
- Planned frontend: `frontend/src/<feature>/{pages,components,hooks}/`, shared `components/ui/`, `services/`, and `stores/`.
- Keep application manifests, lockfiles, and `.env.example` separate. Create folders when responsibilities exist.

Read relevant PRD sections before changing booking, payments, availability, refunds, or notifications.

## Build, Test, and Development Commands

No runnable scripts exist yet. After scaffolding, document verified install, development, build, typecheck, lint, and test commands. Vite bundling must include TypeScript verification. Prisma migration workflow uses `migrate dev` in development and `migrate deploy` for deployment; generate the client after schema changes.

## Coding Style & Architecture

Use TypeScript, NestJS/Express, Prisma, and PostgreSQL; frontend uses React/Vite, React Router, Axios, TanStack React Query, Zustand, React Hook Form, Tailwind CSS, and shadcn/ui. Lock compatible versions during scaffolding; configure formatting then.

Controllers handle HTTP/guards; services own business rules and entity authorization; repositories own meaningful persistence. Validate DTOs with class-validator/class-transformer and global ValidationPipe. Use `/api`, transaction-owned business actions, parameterized locks, and PostgreSQL outbox workers. Send external effects after commit.

Use UUID entity IDs, PascalCase Prisma models, camelCase fields, and snake_case SQL mappings. Preserve rupiah precision and snapshots. React Query owns server data; invalidate affected queries after mutations. Use Indonesian UI and WIB business time. Authentication belongs to iRent.

## Testing Guidelines

Framework and coverage targets remain unset. Implement PRD scenarios with behavior-based names, such as `rejects_overlapping_unit_bookings`. Test contention, idempotency, deadlines, authorization, refunds, extensions, and verified returns/preparation. Use PostgreSQL for concurrency tests.

## Commit & Pull Request Guidelines

Use imperative commits, such as `Add booking availability validation`. PRs explain behavior, reference requirements, report verification, and describe migrations/configuration. Include screenshots for UI changes.

## Security & Agent Workflow

Keep proofs private, encrypt NIK, enforce server authorization, and exclude secrets/runtime files from Git. `VITE_*` configuration is public. Preserve transaction history and existing data.

For conversational software work, resolve the actual user home and read `~/.agents/skills/dev-flow/SKILL.md`. Use ordinary Indonesian conversation, Matt Pocock engineering, and Taste visual guidance. Use OpenSpec only when explicitly requested or continuing an identified OpenSpec change.
