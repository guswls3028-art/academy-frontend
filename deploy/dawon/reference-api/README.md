# Dedicated HakwonPlus reference origin R49

Runtime files under `standalone/` are packed with an explicit SHA-256
manifest by `seal-standalone.py`. The independent API reuses the verified
Academy R47 image without editing its layers or active runtime. It starts
`review-api-r49`, PostgreSQL, Redis, one persistent DB volume, and an
internal Docker network. No host port, metadata path, production endpoint,
current demo DB or shared signing key is used. Only Caddy joins the comparison
internal network when the protected route is mounted. It strips forwarding,
cookies and tenant claims and pins the upstream host. Public DNS and Worker
traffic are handled separately.

Initial installation creates two root-readable credential files on the
existing dedicated host. The API file has freshly generated database, admin
and signing secrets. The DB file contains only PostgreSQL credentials. Use
`start-isolated.sh` only against absent, exact owned resources. It migrates,
seeds once and reruns seed as a no-write check. An ordinary restart starts the
existing DB, cache and API containers, in that order. It does not rerun seed or
reset the sample data. Recreate an API from its exact current package, isolated
network, existing credential file and same image; do not initialize the DB.
The memo and normal synthetic work data survive an API restart.

The shared synthetic administrator has already completed the first-login
account tour. Native credential guidance applies to individually issued
accounts. For R49 the active API package is recorded at commit `e2ba16cd3`.
The fresh-install manifest in this directory changes only the seed. The
existing comparison account received the same onboarding state in place.

The reserved protected route is `/__reference/api/v1/*`. The existing origin
key authenticates the route. A bodyless `POST /api/v1/reference/session/`
uses the one independently seeded administrator and the regular Django token
serializer. Tokens carry tenant 849 plus distinct audience/issuer and
refresh validates their membership and version. Successful API responses
must have tenant header 849. Credentials never reach the browser.

The comparison uses stock Django permissions for ordinary local lecture,
section, session, enrollment, exam, homework, attendance, clinic and result
operations. A stock memo PATCH accepts only memo on contact-free fixture
students. Shared credential/account changes, tenant management, billing,
provider effects, upload/queue jobs and destructive actions that could
remove the shared fixture are blocked. Denial responses direct the visitor
to Dawon admin for out-of-scope workflows.

Use `mount-protected.sh validate` to render and validate the exact additive
Caddy candidate before applying. `apply` retains the original Caddy bytes,
mounts the comparison route and checks both existing APIs. `rollback`
restores the exact original configuration and disconnects only Caddy from
the reference network. It preserves the isolated database, image and
credential files. If a later infrastructure decision requires restoring the
old R37 API, stop the comparison candidate before starting the retained R37
container to preserve the capacity envelope, and recheck R48/R46 plus R37
static. No historical database, container or image is deleted.
