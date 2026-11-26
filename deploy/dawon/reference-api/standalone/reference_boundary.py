"""Keep the shared synthetic account and external systems outside the demo."""
import json
import re
from django.http import JsonResponse

HOST = "reference.hakwonplus.localhost"
PERMITTED_POST = frozenset({"/api/v1/reference/session/","/api/v1/token/refresh/"})
EXCLUDED = (
    "/api/v1/internal/","/api/v1/billing/","/api/v1/messaging/",
    "/api/v1/payments/","/api/v1/tenants/","/api/v1/platform/",
    "/api/v1/tools/","/api/v1/ai/",
)
MEMO = re.compile(r"/api/v1/students/([1-9][0-9]{0,12})/")
ORDINARY_WORK = (
    "/api/v1/lectures/","/api/v1/enrollments/","/api/v1/exams/","/api/v1/homeworks/",
    "/api/v1/homework-results/","/api/v1/clinic/","/api/v1/results/","/api/v1/progress/",
    "/api/v1/staffs/work-records/","/api/v1/staffs/expense-records/",
    "/api/v1/staffs/work-month-locks/","/api/v1/staffs/staff-work-types/",
)
EXTERNAL_OR_IDENTITY_WRITE = re.compile(
    r"(?:^|/)(?:notify|notifications?|alimtalk|send|resend|register-and-notify|password-reset|change-password"
    r"|phone-verification|credentials?|impersonat\w*|upload(?:s|[-_][a-z_-]+)?|[a-z_-]*[-_]upload|import(?:[-_][a-z_-]+)?|jobs|presign|export(?:-[a-z]+)?)"
    r"(?:/|$)"
)
DESTRUCTIVE = re.compile(r"(?:^|/)(?:(?:[a-z]+[-_])*delete|withdraw|end|archive|deactivate)(?:/|$)")

def reject(status=404):
    return JsonResponse({"detail":"이 작업은 합성 원본 비교에서 사용할 수 없습니다. 다원 관리자에서 체험해 주세요."},
                        status=status,headers={"Cache-Control":"private, no-store"})

def memo_only(request,student_id):
    if request.content_type != "application/json":
        return False
    try:
        size=int(request.META.get("CONTENT_LENGTH") or 0)
        if not 0<size<=12000:
            return False
        body=json.loads(request.body)
    except (ValueError,UnicodeError):
        return False
    if not isinstance(body,dict) or set(body)!={"memo"} or not isinstance(body["memo"],str) or len(body["memo"])>500:
        return False
    from apps.domains.students.models import Student
    sample=Student.objects.filter(pk=student_id,tenant_id=849,tenant__code="hakwonplus",
                                  ps_number__startswith="REF-",parent__isnull=True,deleted_at__isnull=True).only("phone","parent_phone").first()
    return sample is not None and not (sample.phone or sample.parent_phone)

class ReferenceBoundary:
    def __init__(self,get_response):
        self.get_response=get_response

    def __call__(self,request):
        path=request.path_info
        method=request.method
        read=method in {"GET","HEAD","OPTIONS"}
        if path=="/healthz" and method in {"GET","HEAD"}:
            return self.get_response(request)
        if request.get_host()!=HOST or request.headers.get("X-Tenant-Code") not in ("hakwonplus",None):
            return reject()
        if path == "/api/v1/messaging/info/" and method in {"GET", "HEAD"}:
            return self.get_response(request)
        if not path.startswith("/api/v1/") or path.startswith(EXCLUDED):
            return reject()
        if path in {"/api/v1/token/","/api/v1/students/demo-session/"}:
            return reject()
        if read or method=="POST" and path in PERMITTED_POST:
            return self.get_response(request)
        if method=="PATCH" and (match:=MEMO.fullmatch(path)):
            return self.get_response(request) if memo_only(request,int(match[1])) else reject(403)
        if (method in {"POST","PUT","PATCH"} and path.startswith(ORDINARY_WORK)
                and not EXTERNAL_OR_IDENTITY_WRITE.search(path) and not DESTRUCTIVE.search(path)):
            return self.get_response(request)
        return reject(403)