# Quickstart: Course Publishing & Readiness Gate — manual verification

Prerequisites: 003–006 in place; signed in as an **instructor** who owns at least one course; a **second**
instructor account for the ownership checks; a **student** account for the catalog and access checks;
backend and frontend dev servers running.

## Setup

```bash
# From backend/ — no migration for this feature; run only if you have pending ones from 006
python manage.py migrate
```

```bash
# From front-end/ — no new dependency for this feature
npm run dev
```

Optional setting (has a working default in `settings.py`):

| Setting | Default | Meaning |
|---------|---------|---------|
| `DEFAULT_THROTTLE_RATES['course_publish']` | `20/min` | Ceiling on publish/unpublish per caller. |

No Cloudinary, Stripe, or webhook tunnel is needed for this feature — but step 4 needs a lecture whose
video actually reached **ready**, so use a course you already completed under 006.

## Backend verification

```bash
# From backend/ — the provider is mocked, so this never touches Cloudinary
python manage.py test apps.course.tests_publishing
```

## Walkthrough

1. **An empty course is honest about it.** Create a fresh course (My Courses → New) with no thumbnail and no
   content. Open its **Overview**. The readiness checklist lists the blockers — missing thumbnail, no
   sections — and **Publish is unavailable with the reason visible**, not a bare disabled button.
2. **Every blocker links to its fix.** Click each blocking entry and confirm it lands on the right place:
   thumbnail → the edit form; sections → Curriculum; a lecture's video → that lecture's editor; a quiz →
   that quiz's editor. A link that goes nowhere useful is the main thing to look for here.
3. **Blockers clear live, without a reload.** Add a thumbnail via Edit, come back, and confirm that entry
   now passes **without** refreshing the page. Add a section and leave it empty: confirm the checklist now
   names *that specific section* as empty. Add a lecture to it.
4. **A processing video is a different blocker from a missing one.** With a lecture that has no video,
   confirm the entry reads as *missing*. Start an upload and, while it transcodes, confirm the entry changes
   to *still processing* — this is the distinction that tells you to wait rather than re-upload. Let it reach
   ready.
5. **A half-written quiz blocks.** Add a quiz to a section and leave it with no questions → blocked. Add a
   question with text but only one answer, or with no answer marked correct → still blocked, naming the
   quiz and how many questions are incomplete. Edit a choice and confirm the checklist refreshes (this is
   the case the question/choice invalidation fix exists for). Finish the question → the blocker clears.
   Then **delete the quiz entirely** and confirm the course is publishable with no quizzes at all.
6. **Advisories never stop you.** With every blocker cleared but no language and no learning goals, confirm
   those appear as **advisory** suggestions, visually distinct from blockers, and that **Publish is
   available**. Set the price to 0 and confirm it is still publishable.
7. **Publish.** Click Publish. The course reports published without a reload, and My Courses shows it under
   the **Published** filter. Sign in as the **student** and confirm it appears in the catalog and search and
   can be enrolled in.
8. **Publish is idempotent.** Double-click Publish, or replay the request. Expect no error and no second
   effect — you are simply told it is already published.
9. **The gate cannot be bypassed from a stale page.** The important one. Open the Overview of a ready course
   in two tabs. In tab A, remove the only video from one of its lectures. In tab B (whose checklist still
   says ready), click **Publish**. Expect a **refusal naming the missing video**, the course still a draft,
   and tab B's checklist refreshing to the truth.

   Same check from the shell, bypassing the UI entirely:

   ```bash
   curl -i -X POST http://localhost:8000/courses/instructor/courses/<id>/publish/ \
     -H "Cookie: access_token=<instructor-token>"
   ```

   Expect **400** with `{"error": "...", "blockers": [...]}` and no change in the DB.
10. **A live course that breaks is flagged, never auto-unpublished.** On the published course, remove a
    lecture's video. Confirm: it is **still published** and **still in the student catalog**, the Overview
    shows a **needs-attention** banner naming the lecture, and My Courses distinguishes it from healthy
    published courses. Put the video back and confirm the flag clears **without republishing**.
11. **Editing a live course warns you.** Open Edit on the published course and confirm the reminder that
    changes are immediately visible to enrolled students.
12. **Unpublish says both halves.** Enroll the student in the published course first. Then click Unpublish.
    The confirmation must state that the course leaves the catalog and takes no new enrollments **and** that
    the students already enrolled keep full access — with the enrolled count named. **Cancel** → nothing
    changes.
13. **Unpublish keeps its promise.** Confirm it. Then, as the **student**: the course is gone from the
    catalog, search, and homepage, and cannot be newly enrolled in — but the *already enrolled* student can
    still open it from their dashboard, play a video, take a quiz, and see their progress and order
    unchanged. This is the single most important behaviour to verify by hand.
14. **Republish re-runs the gate.** Back as the instructor, publish the course again. It goes through the
    checklist afresh and returns to the catalog.
15. **Nobody touches another instructor's course.** As **instructor B**, against instructor A's course id:

    ```bash
    curl -i http://localhost:8000/courses/instructor/courses/<A-course-id>/readiness/ \
      -H "Cookie: access_token=<instructor-B-token>"
    curl -i -X POST http://localhost:8000/courses/instructor/courses/<A-course-id>/unpublish/ \
      -H "Cookie: access_token=<instructor-B-token>"
    ```

    Expect **404** on both — nothing about A's course exposed — and A's course **still published**. Repeat
    the publish call as a **student** account and expect **403**.

## What "done" looks like

- A complete course goes draft → live from the Overview, no admin involved, no page reload.
- Every blocker is named specifically and one click from its fix.
- A stale or crafted publish request is refused on current state, with reasons.
- Advisories, a zero price, and a course with no quizzes never block.
- A live course that breaks gets flagged — and is **never** unpublished by the system.
- After unpublishing, an enrolled student loses nothing.
- `python manage.py test apps.course.tests_publishing` passes.
