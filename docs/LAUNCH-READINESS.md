# Launch Readiness Status

**Date:** 2026-03-17
**Version:** V1.1.1

---

## Verified Status

### Strongly Verified (E2E browser tests, 47/47 PASS)

| Category | Tests | Method |
|----------|-------|--------|
| Student↔Teacher round-trip: QnA | 4 | UI-driven + API |
| Student↔Teacher round-trip: Notice | 3 | API-assisted |
| Student↔Teacher round-trip: Clinic | 3 | API-assisted |
| Admin UI: notice create | 3 | UI-driven |
| Admin UI: QnA reply | 3 | UI-driven |
| Admin UI: clinic create | 3 | API-assisted |
| Page entry: admin login, community, lectures | 5 | UI-driven |
| Page entry: student login, sessions, video, clinic | 4 | UI-driven |
| Tenant branding: tchul, sswe, cross-brand | 4 | UI-driven |
| Tenant isolation: ID sets, cross-access, post access, branding | 4 | API-assisted |
| Failure/edge: unauth, 404, role, token, resource | 5 | UI-driven + API |
| Complaint prevention: duplicate submit, refresh, mobile viewport | 5 | UI-driven |
| HLS video playback | 1 | Manual (user confirmed) |

### Operationally Observable

| Component | Mechanism | Status |
|-----------|-----------|--------|
| Backend structured logs | `JsonFormatter` → JSON lines | Active |
| Request correlation IDs | `CorrelationIdMiddleware` → X-Request-ID | Active |
| Health checks | `/healthz` (liveness), `/health` (readiness) | Active |
| Frontend Sentry | `@sentry/react` in `main.tsx` + `ErrorBoundary` | **Implemented, DSN required** |
| Backend Sentry | `sentry-sdk[django]` in `base.py` + context middleware | **Implemented, DSN required** |
| Deploy verification | CI verify job: healthz + ASG health | Active |

### Manual Verification Required (one-time)

| Item | Status |
|------|--------|
| Notification (알림톡) real delivery | API verified, device receipt unconfirmed |
| Safari login + dashboard | Not tested |
| Firefox login + dashboard | Not tested |
| Large file upload (100MB+) | Not tested |
| Slow network (3G) UX | Not tested |

---

## Activation Checklist

### 1. Sentry (error monitoring)

**Backend** — add to `.env` (or SSM/user-data):
```
SENTRY_DSN=<backend project DSN from sentry.io>
SENTRY_ENVIRONMENT=production
```

**Frontend** — add to Cloudflare Pages environment variables:
```
VITE_SENTRY_DSN=<frontend project DSN from sentry.io>
```

**Verification:** Backend DEBUG mode → `GET /sentry-test/` → check Sentry dashboard.

### 2. CI E2E Gate

**GitHub Secrets** — add to `guswls3028-art/academy-frontend` repo:
```
# Required (6)
E2E_ADMIN_USER=admin97
E2E_ADMIN_PASS=test1234
E2E_STUDENT_USER=3333
E2E_STUDENT_PASS=test1234
TCHUL_ADMIN_USER=01035023313
TCHUL_ADMIN_PASS=727258

# Optional (defaults exist)
E2E_BASE_URL=https://hakwonplus.com
E2E_API_URL=https://api.hakwonplus.com
```

**Effect:** PR to main touching `src/**` or `e2e/**` will run 47 E2E tests. Failure blocks merge.

### 3. Manual Verification (one-time, ~15 min total)

| # | Action | Pass condition | Time |
|---|--------|----------------|------|
| 1 | Teacher creates student with 알림톡 ON → check KakaoTalk | ID/password in message | 3min |
| 2 | Safari → tchul.com → login → dashboard | Layout OK, no crash | 2min |
| 3 | Firefox → tchul.com → login → dashboard | Layout OK, no crash | 2min |
| 4 | Admin → video upload (100MB+) | Progress bar, completion feedback | 5min |
| 5 | Chrome DevTools → Slow 3G → student dashboard | Loading shown, no crash | 2min |

---

## Launch Blockers

**None.**

Sentry and CI E2E are not blockers — they are operational improvements. The system functions correctly without them. With them, it becomes observable and CI-gated.

---

## Recovery

See `backend/docs/OPERATIONAL-RUNBOOK.md` for:
- Video stuck/failed recovery (6 commands)
- Messaging/template management (4 commands)
- Student/tenant administration (6 commands)
- Deployment rollback procedure
- Sentry verification
