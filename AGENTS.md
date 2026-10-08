# Repository Guidelines

## Project Structure & Module Organization

iRent Semarang is currently a planning workspace for an iPhone and accessory rental website with a customer interface and an admin PWA.

- `PRD.md` is the single source of product requirements, incorporating the baseline PRD and agreed product decisions. Section 19 lists unresolved questions.
- Application source, tests, assets, and dependency manifests have not been created. Establish their locations when choosing the stack.

Before changing booking, payment, availability, refund, or notification behavior, read the relevant sections of `PRD.md`. Resolve remaining ambiguities before implementing affected behavior.

## Build, Test, and Development Commands

No build, development, lint, or test commands exist yet. Use `rg --files --hidden` to inspect available files. After scaffolding, document verified installation, local development, build, and test commands here, using the actual framework configuration.

## Coding Style & Architecture

Follow the selected framework's standard indentation and formatter once configured; neither is currently established. Use descriptive domain names such as `BookingService`, `AvailabilityService`, and `PricingService`. Keep business rules in services shared by customer and admin interfaces. Store configurable rental values in settings and preserve transaction snapshots. Use Indonesian for interface text and `Asia/Jakarta` for business time.

## Testing Guidelines

No testing framework or coverage percentage is configured. Implement the PRD's automated business-rule tests with behavior-based names, for example `rejects_overlapping_unit_bookings`. Prioritize simultaneous requests for the last unit, duplicate submissions, payment deadlines, refunds, authorization, extensions, and verified returns followed by preparation time. Document the test command when available.

## Commit & Pull Request Guidelines

Use concise imperative commit messages, such as `Add booking availability validation`. Merge requests should explain the behavior change, reference relevant product decisions or issues, report validation, and include screenshots for UI changes. Describe migrations and new configuration where applicable.

## Security & Agent Workflow

Keep payment proofs private, encrypt NIK, enforce server-side ownership checks, and keep credentials outside version control.

For conversational software work, resolve the actual user home and read `~/.agents/skills/dev-flow/SKILL.md`. Use ordinary Indonesian conversation, Matt Pocock engineering, and Taste visual guidance. Use OpenSpec only when explicitly requested or continuing an identified OpenSpec change.
