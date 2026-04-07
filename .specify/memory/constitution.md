<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version Change: 0.0.0 → 1.0.0 (Initial ratification)
Modified Principles: None (first-time creation)
Added Sections:
  - I. Type Safety First (TypeScript Strictness)
  - II. Component-First Architecture
  - III. Security-First Development
  - IV. Testing Discipline
  - V. Documentation as Code
  - Architecture Decisions section
  - Development Workflow section
Removed Sections: None
Templates Updated:
  ✅ .specify/templates/plan-template.md - Constitution Check section validated
  ✅ .specify/templates/spec-template.md - Aligned with principles
  ✅ .specify/templates/tasks-template.md - Task categorization aligned
Follow-up TODOs: None
================================================================================
-->

# LMS Constitution

## Core Principles

### I. Type Safety First (TypeScript Strictness)

All frontend code MUST be written in TypeScript with strict mode enabled. Type definitions MUST be explicit - no implicit `any` types allowed. Interfaces for API contracts MUST be shared between frontend and backend or duplicated accurately to prevent drift. Zod schemas MUST validate all user inputs and API responses at runtime.

**Why**: The LMS handles sensitive student data, payment information, and educational content. Type safety prevents runtime errors that could corrupt data or expose security vulnerabilities.

### II. Component-First Architecture

Frontend components MUST follow Atomic Design methodology (atoms, molecules, organisms). Each component MUST be self-contained with its own styles, types, and tests. Props interfaces MUST be explicit and documented. Compound components preferred for complex UI patterns.

**Why**: The LMS has a rich, interactive UI with reusable elements (course cards, video players, quiz interfaces). Atomic Design enables consistent UI/UX and parallel development.

### III. Security-First Development

JWT tokens MUST be stored in HttpOnly cookies, never localStorage. All API endpoints MUST authenticate via CookieJWTAuthentication. Payment processing MUST use Stripe with webhook verification. OAuth flows MUST validate state parameters. SQL injection prevention via Django ORM (no raw SQL).

**Why**: The LMS processes payments, stores PII, and handles authentication for three user roles (student, instructor, admin). Security breaches could expose financial and educational records.

### IV. Testing Discipline

Backend code MUST have unit tests for models and services. Frontend components SHOULD have component tests for complex interactions. Integration tests REQUIRED for authentication flows and payment webhooks. Tests MUST run in CI before merge.

**Why**: Critical paths (enrollment, payments, progress tracking) affect revenue and student outcomes. Testing prevents regressions in these core flows.

### V. Documentation as Code

CLAUDE.md MUST be kept current with architectural decisions. API contracts MUST be documented. Complex business logic MUST have inline comments explaining the "why". Environment setup MUST be documented in README or CLAUDE.md.

**Why**: LMS systems have complex business rules (enrollment logic, quiz scoring, progress calculation). Documentation preserves institutional knowledge as the team evolves.

## Architecture Decisions

### Technology Stack

- **Backend**: Django 6.0 + Django REST Framework + PostgreSQL
- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS v4
- **State Management**: TanStack Query for server state, Zustand for client state
- **UI Components**: shadcn/ui with Radix primitives
- **Forms**: React Hook Form + Zod validation
- **Media Storage**: Cloudinary
- **Payments**: Stripe

### Security Requirements

- CORS configured only for `http://localhost:3000` in development
- Cloudinary used for all media (not local filesystem)
- Email currently console backend for development
- Quiz pass threshold: 50% (configured in settings.py)

### Performance Standards

- Axios interceptors for automatic token refresh
- React Query caching for course listings and user data
- Image optimization via Cloudinary transformations
- Lazy loading for course content sections

## Development Workflow

### Code Review Requirements

- All PRs MUST pass automated tests
- Backend changes affecting models MUST include migration files
- Frontend components MUST include TypeScript interfaces
- Security-sensitive code (auth, payments) REQUIRES additional review

### Quality Gates

- Lint checks pass (ESLint, pylint)
- Type checking passes (tsc, mypy where configured)
- No console errors in production build
- API contracts remain backward compatible

### Feature Implementation

- Use `/speckit.plan` for feature planning
- Use `/speckit.spec` for detailed specifications
- Use `/speckit.tasks` for task breakdown
- Store feature documentation in `.specify/` directory

## Governance

This constitution supersedes all other development practices. Amendments require:

1. Documentation of the proposed change
2. Review of impact on existing principles
3. Approval from project maintainer
4. Update to constitution version and amendment date

All PRs and reviews MUST verify compliance with these principles. Complexity MUST be justified with reference to specific requirements. Use CLAUDE.md for runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-04-06 | **Last Amended**: 2026-04-06
