# Godmin public resource board

The existing godmin homepage keeps its saved configuration and layout. Its menu
links to `/landing/resources`, a two-column desktop board (matchup / analysis),
stacked at 390px. Login places `홈페이지` immediately left of `아이디 찾기`.
GodminLandingPage is the existing dedicated public homepage. Its route does not
depend on the generic LandingPage draft being published; that draft is preserved.

Anyone, including unauthenticated visitors, may open a category, read a post,
reload it, render PDF through the established PDFJS component and download the
original PDF/HWP/HWPX. Downloads obtain a fresh link on each click. Hangul files
show a compatible-program instruction. Loading, empty, not-found, connection,
validation and action failures have visible states; connection errors can retry.

The server capability endpoint controls publishing affordances; client roles or
display names do not grant permission. Only the two configured active godmin
publisher accounts may upload/create/edit/delete. `/resources/write` and
`/:id/edit` show a clear unauthorized state for other accounts. Capability
failure has an explicit retry. Backend policy and exact IDs are owned by
academy-backend `docs/domain/public-resource-board.md`.

Uploading does not publish. The publisher selects a category, title, optional
description and 1–5 files (each nonempty, up to 30 MiB). Local extension/size
checks are supplemented by server format checks. Successful uploads remain in
the form if a subsequent file fails. `게시하기` is explicit public publication;
network retries preserve the request UUID and input. Editing retains existing
attachments, including those originally uploaded by the other publisher. File
removal and cancellation clean the current uploader's pending files; failure
leaves an explicit retry with the form intact. Attached manual documents are
retained privately when removed or their post is deleted. Browser close/offline
cleanup is best effort; server recovery retains private pending metadata.

Desktop and 390px checks include long Hangul names, multiple attachments,
keyboard focus, touch targets, reduced motion, both categories, uploader success,
anonymous reload/download bytes/PDF canvas, permission errors, failed upload,
cancel, edit and deletion. Exact-artifact isolated development, required frontend
gates and zero disposable QA rows/storage keys are required before promotion.
Production checks are observational and must preserve customer data.
