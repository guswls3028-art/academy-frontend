# Public board with whole-file reading

The existing godmin homepage keeps its saved configuration and layout. Its menu
links to `/landing/resources`. The shared homepage exposes the same isolated board
for tchul and later tenants. Login places `홈페이지` immediately left of `아이디 찾기`;
GodminLandingPage remains independent of the generic unpublished landing draft.

Teachers finish and edit documents on their own computers, then upload each complete file. The homepage replaces their cafe publishing workflow; it does not author or restructure their reports.

Visitors browse a familiar single-column post list with a title, optional excerpt, author/date and compact 전체/매치업/분석자료 filters; long
titles/excerpts are clamped while the detail preserves the full text. The reading
journey is article heading → visible original downloads → authored body →
automatically opened reports. The header aligns author/date with link copying;
each original keeps its filename, format, size and its own download action.
PDF originals say `PDF 다운로드`; other formats say `원본 다운로드` and retain
their exact bytes. `본문 바로보기` moves keyboard/touch users to the reading
content. Downloads are no longer collapsed below long reports, because visitors
who prefer their own viewer could not find them. Inline reading remains automatic.
Download progress and retryable failures appear beside the top download flow.
No API, publication permission, file ordering or stored content changes.
On mobile, the article spans the available width with 16px content gutters;
download actions, inline zoom and fullscreen controls remain grouped and touchable.
Header/title use the resolved tenant's program name with a neutral loading state.
A single layout owner updates the article/tenant browser title without a late brand request overwriting it, offers link copying and a return to other
articles. Login preserves the board return path.

## Reading and recovery

Anyone, including an unauthenticated visitor, can read and reload a published
article. No separate PDF-preview click is required. Prepared PDF, HWP/HWPX and
DOCX/XLSX/PPTX display their original pages as server-generated PNG images.
Normal reading needs no PDFJS display/worker, canvas, embedded browser font or
new typed-array APIs. The app retains its legacy iOS/Android bootstrap targets;
the native reader uses ratio padding for browsers without CSS aspect-ratio.
Only nearby pages mount images, releasing offscreen images to bound phone memory.
Zoom spans 100–300% with keyboard-accessible horizontal scrolling. Extracted
per-page text is available to assistive technology.

Prepared page documents also offer `전체화면 보기`. It opens a paged native-image
viewer over the current article, centering the whole page within the available
screen at 100% in both portrait and landscape, with no document scrolling. It fits
both dimensions again when the screen rotates. The opening click requests native
fullscreen with hidden navigation UI when the standard API is available; close,
browser Back, Escape or native fullscreen exit release only this viewer's owned
session. A rejected request, unavailable API or a late request after closing
keeps the same readable paged viewer and safe exit. No external viewer is needed.
On iPhone Safari, [HTML fullscreen remains unsupported](https://bugs.webkit.org/show_bug.cgi?id=206854);
Safari's [page menu → More → Hide Toolbar](https://support.apple.com/ko-kr/guide/iphone/-iphb3100d149/ios)
can enlarge the visible browser area. The viewer follows the Visual Viewport's
height and top offset when browser bars or keyboards change, batches resize/scroll
measurements in an animation frame, and falls back to inner height when the API
is absent. Browser pinch zoom is not counteracted. The browser theme color blends
with the dark reading surface during viewing and is restored on exit.
Mobile browsers without an active native/standalone fullscreen session offer
`화면 안내` in the tap-revealed header: Safari toolbar hiding and opening an in-app
link in Safari/Chrome. This help stays closed during ordinary reading; while open
its controls stay visible and Escape closes help before closing the viewer. This
does not claim that web code can force iPhone Safari's browser chrome to disappear.
Swipe left/right
at 100%, use previous/next or select a page; at 125–300% touch scroll pans the
document instead of turning pages. The percentage control restores screen fit
and clears both scroll offsets. Header and footer overlay the page and fade away
2.2 seconds after the initial ready page or an explicit control interaction;
tapping the page toggles them. Page swipes, subsequent image loading, rotation and
URL renewal preserve hidden controls so reading is not interrupted by page/zoom UI.
Native taps work even when a browser omits click after swiping, and a
subsequent compatibility click cannot toggle the controls a second time.
Keyboard navigation keeps them visible and restores modal focus if touch
or rotation has blurred it to the body. Initial loading and errors retain visible
exit/retry controls; a tap can reveal controls while a later page loads. Controls remain accessible above safe-area insets, and
motion respects reduced-motion settings. Only the selected full-screen page
mounts an image. Extracted page text remains accessible.

The opening action creates the owned history entry synchronously, and the
already-mounted reader registers Back before paint. A visible viewer therefore
supports immediate Back/re-entry even while timers are paused; StrictMode's
viewer mount rehearsal does not add or unwind history entries.
Close, Escape and browser Back return to the original article position and
inline zoom; focus is restored to the opening action. Focus stays in the modal
while the background is hidden from assistive technology and locked against
scrolling. The existing reader owns permissions, link renewal and retry: fresh
URLs preserve the selected viewer page and zoom, and visible failures retain
close/retry controls. If renewal changes the document to article/PDF-only output
or an unsupported format, the paged viewer closes and releases its owned native
fullscreen; the article and available inline/original-file actions remain usable.
Restoring native page images makes the entry available without reopening it.
No uploads, new data, permissions or third-party sharing
are introduced. Old PDF-only rollout payloads retain their inline fallback;
the full-screen entry appears when native page images are ready.

Focused desktop/390px checks cover first/last page boundaries, page selection,
swipe-versus-pan, centered scroll-free fit after rotation, uninterrupted hidden controls across swipes/renewal, automatic control hiding,
tap/keyboard recovery, actual enlargement, URL renewal and link-error
recovery, native fullscreen entry/exit/rejection/late completion, focus/scroll restoration, Back and article reload. Same-artifact
development real-use opens the uploaded report in the viewer before promotion.

Fresh five-minute image links renew after four minutes and when a background tab
returns. Overlapping resume/poll events share one active reader request, preventing
duplicate network work and older renewal responses from replacing a newer result.
The next poll/recovery remains scheduled after that request completes.
Image failure refreshes links with throttling and offers explicit retry;
same-link retry also remounts images. Renewal/retry preserves page layout and zoom.
The legacy PDFJS viewer is lazily loaded only for old backend payloads during
compatible rollout; existing published reports must be explicitly prepared before
declaring old-device support. A Map polyfill alone did not cover other recent
PDFJS APIs, so the previous browser-PDF path is replaced for prepared reports.
Desktop/390px tests remove Map upsert, Promise.withResolvers, Uint8Array.toBase64,
AbortSignal.any and Float16Array and verify native page decoding, complete reading,
zoom, reload, delayed resume coalescing, fallback/unsupported fullscreen recovery
and link-failure recovery without requesting a PDF worker or rendering
a canvas. A shared vendor module may still contain unused PDF-library code.

HWP/HWPX and Office documents automatically display their original pages, including
tables, images and formulas, through the same native page reader. There is no
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

Article URLs render their title, plain-text summary and canonical URL in the
initial Pages HTML for sharing and crawlers. Only the active hostname's backend
tenant code selects the anonymous resource API; no caller credentials or default
tenant are reused. Article metadata is not cached. Deleted/foreign posts retain
404 and noindex, and lookup failures do not index an invented article. All dynamic
metadata is escaped as HTML text/attributes without changing stored content.
`pwa-branding-contract.spec.ts` covers special characters, tenant selection,
canonical metadata and deletion after an earlier successful lookup.
The Pages request uses `redirect: "manual"` and rejects non-2xx responses,
including all redirects, without forwarding the tenant header to another URL.
Cloudflare's workerd rejects `redirect: "error"` before sending a request, even
when the API would return 200; Node-only mocks must reproduce that runtime
constraint. Regression checks include successful/deleted metadata and upstream
301/302/303/307/308/503 recovery. Release readback also checks the deployed
initial HTML against an existing public article and a nonexistent article,
not only the client-rendered page or the static tenant title.

Legacy stylesheet injection uses `window.document` because CSS modules can
export a local `document` class binding. Verify the compiled SystemJS artifact,
including report reading, zoom, renewal and reload, with the modern entry disabled;
development-server checks alone cannot detect this bundle-only failure.
