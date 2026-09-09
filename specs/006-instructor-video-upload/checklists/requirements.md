# Specification Quality Checklist: Instructor Lecture Video Upload

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-07
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

- **Written retroactively.** Implementation preceded this specification on the branch, contrary to the
  project's spec-first Hard Rule. Recorded openly in the spec's *Implementation Status* section rather than
  quietly corrected: every functional requirement is tagged **(shipped)**, **(corrects)**, or **(new)**, so
  the document doubles as the acceptance checklist for finishing and fixing the delivered pass. The tags
  are the honest part — without them a retroactive spec reads as if everything already works.
- **Scope note**: unlike 005 (thin backend addition, frontend-heavy), 006 carries real backend weight —
  the upload lifecycle (reserve/confirm/promote), webhook integrity (dedupe, replay, ordering), duration
  unit correctness, media cleanup, and abuse limits. One additive migration is required
  (`Lecture.pending_video_public_id`). This is captured in the Overview, Assumptions, and Key Entities
  without naming endpoints or field types in the spec body.
- **Wording on limits** is deliberately capability-level ("a defined maximum file size", "accepted
  formats") rather than naming concrete numbers, so the values can be tuned in settings without a spec
  amendment. The concrete defaults live in `research.md` R5 and `data-model.md`.
- **Boundary with adjacent specs is explicit**: publish-readiness → 007 (this feature exposes the video
  state that gate will consult but never blocks or triggers publishing); video analytics → 009; student
  playback rules unchanged.
- **Deliberately deferred**: no scheduled reconciliation sweep for videos whose notification never arrives.
  No job runner exists (discovery §13.7), and the instructor-facing manual re-check (FR-020) covers the
  user-visible symptom. Listed in Out of Scope as future hardening rather than left unstated.
- One assumption is a genuine product judgement rather than a technical constraint: the measured video
  length **overrides** the instructor's typed duration (FR-014). Recorded as a clarification with its
  rationale and its rejected alternative so it can be revisited deliberately.
