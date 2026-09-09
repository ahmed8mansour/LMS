# Quickstart: Instructor Lecture Video Upload — manual verification

Prerequisites: 003–005 in place; signed in as an **instructor** who owns at least one course with a
section and a lecture; backend and frontend dev servers running; Cloudinary credentials configured and
`CLOUDINARY_VIDEO_WEBHOOK_URL` reachable from the internet (see *Webhooks in development* below).

## Setup

```bash
# From backend/ — one additive migration for this feature
python manage.py migrate
```

```bash
# From front-end/ — no new dependency for this feature
npm run dev
```

Optional settings (all have working defaults in `settings.py`):

| Setting | Default | Meaning |
|---------|---------|---------|
| `VIDEO_MAX_UPLOAD_BYTES` | `2147483648` (2 GiB) | Largest accepted upload; signed into the credential. |
| `VIDEO_ALLOWED_FORMATS` | `mp4,mov,webm,mkv,m4v` | Accepted containers; signed into the credential. |
| `CLOUDINARY_WEBHOOK_MAX_AGE_SECONDS` | `7200` | Notifications older than this are rejected as replays. |

### Webhooks in development

Cloudinary must reach your machine to report transcode outcomes. Expose the backend and point
`CLOUDINARY_VIDEO_WEBHOOK_URL` at the tunnelled `/courses/video/webhook/`:

```bash
ngrok http 8000
```

Without a reachable webhook a lecture legitimately stays in **processing** forever — that is the pipeline
working as designed, not a bug. Steps 4–6 below need the tunnel; the rest do not.

## Backend verification

```bash
# From backend/ — the video suite mocks the provider, so it never touches Cloudinary
python manage.py test apps.course.tests_video
```

## Walkthrough

1. **Open the lecture editor.** My Courses → open a course → **Curriculum** → open a lecture. The video
   area invites you to add a video and **states the accepted formats and the real size limit** (not
   "4MB").
2. **Reject a bad file.** Try a `.pdf`, or a video above the limit. It is refused **before** any transfer
   starts, the message names the actual limit, and the lecture is unchanged.
3. **Upload a video.** Pick a real lecture video — deliberately one **over 100 MB**, which the old
   single-request upload could not handle. Progress reflects actual transfer, not an indeterminate
   spinner. Cancel mid-transfer once and confirm nothing is reported as a failure and the lecture is
   unchanged. Then let one finish.
4. **Watch it process.** On completion of the transfer the lecture shows **processing** without a reload.
   When Cloudinary finishes, it becomes **ready** on its own and you are told.
5. **Check the duration.** Compare the lecture's displayed duration against the file's real length. A
   ten-minute video reads as about `10:00` — **not** `600 min`. This is the regression to watch for.
6. **Play it back.** Play the video in the editor and confirm the file you uploaded is the file that
   landed.
7. **Check the curriculum list.** Go back to **Curriculum**. The lecture's badge reads **ready** and
   agrees with the editor. Start another upload and confirm the badge reads **processing** there — never
   "no video".
8. **Replace safely — the important one.** On a ready lecture, start a replacement and **cancel it**.
   Reload: the original video is still there, still ready, still playable. Now complete a replacement:
   the new video takes over and the lecture returns to processing. Confirm in the Cloudinary console that
   the superseded asset is **gone**, not orphaned.
9. **Abandon an upload.** Open the file picker, pick a file, then close the tab immediately. Reopen the
   lecture: it is exactly as it was — same video, same status, same duration.
10. **Recover from every state.** While a lecture is **processing**, confirm **Remove** and **Replace** are
    both available and both work. Leave one processing past the polling window and confirm the interface
    says it is still processing and offers a **manual re-check** — not a spinner that never resolves.
11. **Remove with confirmation.** Remove a video: you must confirm first. On a course **with enrolled
    students**, the confirmation states they will immediately lose access. Cancel → nothing changes.
    Confirm → the lecture returns to "no video", and its **title and duration are untouched**.
12. **Delete cleans up media.** Delete a lecture that has a video, then a whole section containing one.
    Confirm in the Cloudinary console that those assets are **gone** — deleting the row must not leave
    paid media behind.
13. **Ownership.** As a second instructor, try to sign, confirm, or delete video for the first
    instructor's lecture by ID:

    ```bash
    curl -i -X DELETE http://localhost:8000/courses/video/<other-instructors-lecture-id>/ \
      -H "Cookie: access_token=<instructor-B-token>"
    ```

    Expect **403** with `{"error": "..."}`, nothing exposed, and the lecture unchanged.

14. **Webhook hardening.** Post a notification body with a wrong `X-Cld-Signature` → **400**, no change.
    Replay a genuine, previously-delivered notification → accepted as a **duplicate** (200) with the
    lecture unchanged; replay one with an old timestamp → **400**. Send a generic notification *after* a
    lecture is ready → it stays **ready**.

## What "done" looks like

- A >100 MB video uploads, processes, and plays back, end to end, without a page reload.
- Displayed duration matches the file's real length, in minutes.
- A cancelled or failed replacement never costs you the working video.
- No state leaves you without Remove and Replace.
- The curriculum list and the lecture editor never disagree.
- Deleting content leaves nothing behind in Cloudinary.
- `python manage.py test apps.course.tests_video` passes.
