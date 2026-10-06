# Public board with whole-file reading

The existing godmin homepage keeps its saved configuration and layout. Its menu
links to `/landing/resources`. The shared homepage exposes the same isolated board
for tchul and later tenants. Login places `홈페이지` immediately left of `아이디 찾기`;
GodminLandingPage remains independent of the generic unpublished landing draft.

Teachers finish and edit documents on their own computers, then upload each complete file. The homepage replaces their cafe publishing workflow; it does not author or restructure their reports.

Visitors browse a familiar single-column post list with a title, optional excerpt, author/date and compact 전체/매치업/분석자료 filters; long
titles/excerpts are clamped while the detail preserves the full text. The reading
journey is article → authored body → automatically opened reports → optional
collapsed original files. It replaces the earlier download-first board because
analysis and matchup publications must also work for outside promotional readers.
Header/title use the resolved tenant's program name with a neutral loading state.
A single layout owner updates the article/tenant browser title without a late brand request overwriting it, offers link copying and a return to other
articles. Login preserves the board return path.

## Reading and recovery

Anyone, including an unauthenticated visitor, can read and reload a published
article. No separate PDF-preview click is required. PDF and DOCX/XLSX/PPTX open
as page-preserving documents through the established PDFJS component. Visible
pages render lazily and release offscreen canvases; zoom spans 100–300% with
keyboard-accessible horizontal scrolling. Extracted PDF text is available to
assistive technology. Retry remounts PDFJS even when a refreshed signature is equal. Lazy imports cannot start a detached PDF worker after navigation; cleanup handles cancellation. Each canvas stays within 16 million pixels and an 8192-pixel edge while preserving CSS zoom.

HWP/HWPX and Office documents automatically display their original pages, including
tables, images and formulas, through the same inline PDF viewer. There is no
alternate article schema, formula editor or mode switch for the teacher to learn.
PNG/JPEG/WebP/GIF and UTF-8 text also read inline. Original downloads remain an
optional collapsed section after the displayed document.

Loading, empty, not-found, connection, validation, malformed-reader and conversion
failures are visible. A reader failure offers retry; PDF/image link failures fetch
new URLs. Pending conversion polls with bounded backoff. Failed pagination restarts
from page one so concurrent deletion cannot trap readers on a vanished page.
Unsupported auxiliary originals require authored body; a ZIP is not shown as an
empty successful report. The format/size/page and conversion policy is owned by
academy-backend `docs/domain/public-resource-board.md`.

## Publishing and conflict handling

The server capability endpoint controls affordances. Only the two configured,
active publisher accounts in the resolved tenant may upload/create/edit/delete;
client role labels and names do not grant access. Write/edit routes show an
unauthorized state to others. Capability failure has retry. Existing board
permissions, older community boards and saved homepage configuration are preserved.

The writer chooses the accessible `분류` selector, a title, optional `본문` and 0–5 complete originals
(each nonempty, at most 30 MiB). Text-only posts need a body. The picker accepts all
formats; server validation remains authoritative. Uploading stays private. The
same reader previews the complete file before publication, inside a focusable bounded
viewport after the publish action, so a long report never forces scrolling to its end before publication. Up/down controls persist
report order. Supported reports must prepare successfully; a failed report can be
retried or replaced, with input and original preserved. `게시하기` explicitly makes
the resulting article and reports visible without login.

Upload requests allow 120 seconds for slow transfers. Request UUIDs use the shared
secure fallback on browsers without `randomUUID`. Successful earlier uploads stay
in the form after a later failure. Network retry retains UUID/input. Editing keeps
attachments originally supplied by the other publisher. Removing/cancelling the
current uploader's pending file cleans its original and prepared reader assets;
partial cleanup removes only successful items and leaves explicit retry for the
remainder. An item awaiting cleanup cannot publish. Other pending items can still
be retained. Detached manual files/deleted posts stay private, never auto-deleted.
Closing/offline cleanup remains best effort with private server recovery metadata.

Editing submits the loaded revision. A conflict preserves local input, opens the
latest public post in a separate tab and offers explicitly confirmed cleanup/reload.
It never silently overwrites a newer post. After a lost create response, a changed
retry's 409 identifies only that author's existing published post/revision/files.
The editor keeps its draft and shows published title/body/names for comparison,
then continues as a versioned edit. Published originals stop being pending cleanup.
Another subsequent edit still conflicts normally; no duplicate post is created.

Pending cleanup and repeated confirmed post deletion treat 404 as already
unavailable, avoiding cancellation traps after a lost acknowledgement. Permission
and storage/service failures stay visible and retryable without silently clearing
the draft/public view. A saved body is located in tests by textbox role and exact
accessible name `본문`; wrapping-label text can include textarea contents.

## Verification

Mock browser checks exercise desktop/390px reading, automatically opened PDF,
complete Hangul document pages, long names, tenant branding, both publishers,
categories, original byte downloads, partial cleanup, saved body editing, lost
responses, conflicts and failed conversion → pending retry → ready → publication.
Useful hover/focus feedback, touch targets, reduced motion and overflow checks
remain part of the affected journey. Mock success does not establish native
conversion or production completion.

`admin/public-resource-realuse.spec.ts` uses synthetic documents and the isolated
QA seed's two publishers. Its exact-artifact development journey verifies private
file-only publication with an empty optional body, private preview, anonymous reload, all three PDF pages with enlargement, complete Hangul pages, original bytes, second-publisher edit,
deletion/link revocation and tenant/user/storage-zero cleanup at both sizes.
Edit verification requires a successful PATCH and navigation to the saved article,
then scopes body assertions to that article so editor text and preview cannot be
mistaken for a saved result. Anonymous reload still verifies persistence.
File-only publish/reload checks wait for the uploaded PDF to render before reload
and teardown, verifying the complete reading journey without interrupting pending imports.
Fixture provenance lives in `e2e/fixtures/documents/README.md`.

The release browser boundary accepts an asset only after the exact QA tenant's API
returns its URL. Original UUIDs and derived generation UUIDs must match the current
development bucket/tenant/file path, exact R2 origin, host-only signature and
300-second expiry. Derived names are bounded image-N.webp/png/gif or pages.pdf.
Original downloads retain their 30 MiB cap and attachment disposition, including
original PDF previews. Derived PDFs and images are registered separately: their
native MIME and byte signature must match the exact manifest asset, with the
backend's 60 MiB derived-output cap. They need no attachment disposition and only
use reader fetch/image requests. This prevents the QA proxy from rejecting valid
inline documents while preserving original-download and tenant boundaries.
Application credentials never accompany storage requests; redirects/missing CORS
fail. Real-use origin storage initialization never touches opaque documents.
Teardown records each context error as a failing soft assertion while continuing
cleanup, retaining the original workflow failure.

Required frontend gates, backend candidate runtime, same-artifact development
canary and cleanup zero precede promotion. Production observation preserves all
customer content and uses no synthetic posts.
