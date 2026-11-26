"""Native protected staff board verification with optional isolated write trial."""
import json
import os
from urllib.error import HTTPError
from urllib.request import Request,urlopen
from uuid import uuid4

ROOT="/api/v1/staffs/board/posts/"
TITLE="학원플러스 원본 비교 안내"
external=os.environ.get("REFERENCE_PROOF_ORIGIN_KEY")
endpoint=("https://dawon-review-origin.hakwonplus.com/__reference" if external else "http://127.0.0.1:8000")
token=None

def send(path,status=200,method="GET",body=None,headers=None):
    h={"X-Dawon-Review-Origin":external} if external else {"Host":"reference.hakwonplus.localhost"}
    if token:
        h["Authorization"]="Bearer "+token
    h.update(headers or {})
    raw=json.dumps(body).encode() if body is not None else None
    if raw is not None:
        h["Content-Type"]="application/json"
    request=Request(endpoint+path,data=raw,headers=h,method=method)
    try:
        response=urlopen(request,timeout=12)
    except HTTPError as error:
        response=error
    with response:
        assert response.status==status,(method,path,response.status)
        if status in (200,201):
            assert response.headers.get("X-Tenant-Id")=="849"
            return json.load(response)
        return None

send(ROOT+"?category=notice",401)
token=send("/api/v1/reference/session/",method="POST")["access"]
notice=send(ROOT+"?category=notice&page_size=3")
row=next(item for item in notice["results"] if item["title"]==TITLE)
sample_id=int(row["id"])
post=send(f"{ROOT}{sample_id}/")
assert post["title"]==TITLE and post["body"] and post["can_edit"] and post["replies"]==[]
assert send(ROOT+"?category=notice&q=%EC%9B%90%EB%B3%B8")["count"]>=1
send(f"{ROOT}{sample_id}/attachment/",403)
send(ROOT,403,"POST",{"category":"resource","title":"blocked","body":"blocked"})
result={"passed":True,"tenantId":849,"sampleNoticeId":sample_id,"title":TITLE,
        "dashboardNoticeCount":notice["count"],"nativeListDetailSearch":True,"attachmentAndNonNoticeWritesDenied":True}
if not external:
    import django
    django.setup()
    from django.db import transaction
    from apps.domains.messaging.models import NotificationLog
    from apps.domains.staffs.models import StaffBoardPost,StaffBoardWriteReceipt
    from apps.domains.submissions.models import SubmissionStorageCleanupIntent
    before=(NotificationLog.objects.count(),SubmissionStorageCleanupIntent.objects.count())
    ident=str(uuid4())
    trial_title="QA-R49 공지 저장 "+ident[:12]
    body={"category":"notice","title":trial_title,"body":"격리된 일반 텍스트 공지입니다."}
    context={"Idempotency-Key":ident}
    issued=None
    try:
        issued=send(ROOT,201,"POST",body,context)["id"]
        assert send(ROOT,200,"POST",body,context)["id"]==issued
        send(ROOT,409,"POST",{**body,"title":"충돌"},context)
        path=f"{ROOT}{issued}/"
        changed=send(path,200,"PATCH",{"body":"공지를 정상 수정했습니다."})
        assert changed["id"]==issued and send(path)["body"]=="공지를 정상 수정했습니다."
        assert before==(NotificationLog.objects.count(),SubmissionStorageCleanupIntent.objects.count())
    finally:
        if issued:
            with transaction.atomic():
                exact=StaffBoardPost.objects.get(pk=issued,tenant_id=849,title=trial_title)
                StaffBoardWriteReceipt.objects.filter(tenant_id=849,result_id=issued).delete()
                exact.delete()
    assert not StaffBoardPost.objects.filter(tenant_id=849,title=trial_title).exists()
    result.update(textCreateReplayConflictAndEdit=True,temporaryBoardRows=0,providerSideEffects=0)
print(json.dumps(result,ensure_ascii=False))