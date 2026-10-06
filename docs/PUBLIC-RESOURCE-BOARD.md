# Public resource-sharing board

The existing godmin homepage keeps its saved configuration and layout. Its menu
links to `/landing/resources`, a two-column desktop board (matchup / analysis),
stacked at 390px. Login places `홈페이지` immediately left of `아이디 찾기`.
GodminLandingPage is the existing dedicated public homepage. Its route does not
depend on the generic LandingPage draft being published; that draft is preserved.

Anyone, including unauthenticated visitors, may open a category, read a post,
reload it, render PDF through the established PDFJS component and download the
original files of any format. Header login remembers the board return path. Downloads obtain a fresh link on each click.
Non-PDF files show a compatible-program instruction; the service does not execute
or promise a browser preview for arbitrary originals. Loading, empty, not-found, connection,
validation and action failures have visible states; connection errors can retry.

The server capability endpoint controls publishing affordances; client roles or
display names do not grant permission. Only the two configured active publisher accounts in the resolved tenant may upload/create/edit/delete. `/resources/write` and
`/:id/edit` show a clear unauthorized state for other accounts. Capability
failure has an explicit retry. Backend policy and exact IDs are owned by
academy-backend `docs/domain/public-resource-board.md`.

Uploading does not publish. The publisher selects a category, title, optional
description and 1–5 files (each nonempty, up to 30 MiB). The file picker accepts
all formats, including Office/ZIP/images/custom suffixes and extensionless files.
Local size checks are supplemented by server size/name/document integrity checks. Upload requests allow 120 seconds
for slow transfers; request IDs use the shared secure UUID fallback for supported
browsers without `randomUUID`. Successful uploads remain in the form if a subsequent
file fails. `게시하기` is explicit public publication;
network retries preserve the request UUID and input. Editing retains existing
attachments, including those originally uploaded by the other publisher. File
removal and cancellation clean the current uploader's pending files; failure
leaves an explicit retry with the form intact. Successfully cleaned attachments
disappear immediately even if a later cleanup fails. A file awaiting cleanup is
marked visibly and cannot be published until its cleanup retry succeeds; another
original can then be uploaded. Upload progress names the active file and count. Attached manual documents are
retained privately when removed or their post is deleted. Browser close/offline
cleanup is best effort; server recovery retains private pending metadata.

Editing sends the loaded revision. A conflicting edit preserves the local input,
offers the latest public post in a new tab, and allows explicitly confirmed
cleanup/reload before editing again; it never silently overwrites a newer post.
PDF retry remounts the renderer even if signing returns the same URL, and preview
can be closed. Failed list pagination retries the same page while retaining prior
results. The header/title use the current tenant program name, with a neutral
loading fallback; the shared homepage menu also links to this resource board.
Existing older boards, publisher policies and saved homepage content are preserved.

Desktop and 390px checks include long Hangul names, multiple attachments,
keyboard focus, touch targets, reduced motion, both categories, uploader success,
anonymous reload/download bytes/PDF canvas, permission errors, failed upload,
cancel, edit and deletion. Exact-artifact isolated development, required frontend
gates and zero disposable QA rows/storage keys are required before promotion.
Production checks are observational and must preserve customer data.

The deployment canary `admin/public-resource-realuse.spec.ts` uses the two
synthetic publishers created by the backend isolated QA seed. Its browser boundary
accepts a file GET only after the current QA API returns that exact UUID's signed
URL, restricted to the development bucket, exact QA tenant path, host-only signature
and 300-second expiry. Application credentials never accompany R2 requests;
redirects and missing preview CORS are failures. Byte comparisons, anonymous
reload, retained-attachment editing and delete/link revocation precede the owning
scenario's exact tenant/user/storage-zero cleanup.
