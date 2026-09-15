# Specification Quality Checklist: Course Publishing & Readiness Gate

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-11
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- **Spec-first, unlike 006.** No implementation exists on this branch; there are no
  (shipped)/(corrects)/(new) tags because every requirement is new work. This restores the project's
  spec-first rule after 006's retroactive deviation.
- **The gate is the whole feature.** FR-009 is the single requirement everything else serves: FR-014 makes
  it unbypassable, FR-015 and FR-017–FR-019 make it legible, FR-023–FR-026 keep it honest after the fact.
  A reviewer who disagrees with only one thing should disagree with FR-009's five conditions — that is where
  the judgement lives, and the Clarifications section records the reasoning for each inclusion and each
  deliberate exclusion (quizzes optional, free price allowed, language and goals advisory).
- **Two decisions worth a second look before planning**, both resolved in the spec rather than left open
  because a defensible default exists and deferring them would block the whole feature:
  1. **Never auto-unpublish** (FR-023). A live course that loses a video stays live and gets flagged.
     The alternative — pulling it automatically — protects students at the cost of silently destroying an
     instructor's sales. If the product owner prefers student protection here, FR-023/FR-024 invert and
     SC-008 changes.
  2. **Thumbnail is blocking** (FR-009a). Carried forward from 004's explicit deferral of the thumbnail to
     "a publish-readiness item". Cheap to relax to advisory if it proves an annoying gate in practice.
- **No migration.** Unusually for an instructor spec, this one needs no schema change at all — readiness is
  computed and the publish flag already exists. That is recorded as an assumption so the plan phase does not
  invent a `published_at` or a readiness column; publish history is explicitly out of scope.
- **Cross-spec coupling is deliberate.** The quiz-completeness rule (005 FR-010) and the video state machine
  (006 FR-009) are *referenced*, not restated with new wording — if either definition moves, this gate must
  move with it rather than drift into a second, conflicting definition.
