"""Check actual isolated runtime routes, sample persistence, and denied egress."""
import base64
import json
import os
import socket
from urllib.error import HTTPError
from urllib.request import Request,urlopen

host="reference.hakwonplus.localhost"
base=os.environ.get("REFERENCE_PROOF_URL","http://127.0.0.1:8000")
prefix=os.environ.get("REFERENCE_PROOF_PREFIX","")
protected=os.environ.get("REFERENCE_PROOF_ORIGIN_KEY")
admin_token=None

def call(path, expected=200, *, method="GET", body=None, token=None, extra=None, auth_bound=True):
    headers={"Host":host} if not protected else {"X-Dawon-Review-Origin":protected}
    headers.update(extra or {})
    if token is not None:
        headers["Authorization"]="Bearer "+token
    data=json.dumps(body).encode() if body is not None else None
    if data is not None:
        headers["Content-Type"]="application/json"
    req=Request(base+prefix+path,data=data,headers=headers,method=method)
    try:
        response=urlopen(req,timeout=15)
    except HTTPError as error:
        response=error
    with response:
        assert response.status in ((expected,) if isinstance(expected,int) else expected),(method,path,response.status)
        if response.status!=200:
            return None
        if auth_bound:
            assert response.headers.get("X-Tenant-Id")=="849",path
        return None if method=="HEAD" else json.load(response)

def claims(raw):
    segment=raw.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(segment+"="*(-len(segment)%4)))

def rows(result):
    return result if isinstance(result,list) else (result.get("results") or result.get("rows") or [])

session_path="/api/v1/reference/session/"
call(session_path,expected=(403,404),method="POST",body={})
session=call(session_path,method="POST")
token=session["access"]
identity=claims(token)
assert identity["tenant_id"]==849 and identity["aud"]=="hakwonplus-reference-849"
assert identity["iss"]=="original-demo.hakwonplus.com" and not identity.get("dawon_demo_role")
session_id=int(identity["user_id"])
new=call("/api/v1/token/refresh/",method="POST",body={"refresh":session["refresh"]})
assert claims(new["access"])["tenant_id"]==849
calls=("/api/v1/core/program/","/api/v1/core/me/","/api/v1/clinic/settings/","/api/v1/staffs/",
       "/api/v1/results/admin/landing-stats/","/api/v1/lectures/attendance/arrival-overview/",
       "/api/v1/exams/?exam_type=regular&page_size=1","/api/v1/clinic/participants/")
for path in calls:
    call(path,token=token)
info=call("/api/v1/messaging/info/",token=token)
call("/api/v1/messaging/info/",method="HEAD",token=token)
assert info["alimtalk_available"] is False and info["custom_channel_status"]=="not_configured"
assert not any(info[key] for key in ("own_solapi_api_key","own_solapi_api_secret","own_ppurio_api_key","own_ppurio_account","resolved_pf_id"))
call("/api/v1/messaging/info/",expected=404,method="PATCH",body={"tenant_messaging_enabled":True},token=token)
call("/api/v1/messaging/send/",expected=404,token=token)
students=rows(call("/api/v1/students/",token=token))
lectures=rows(call("/api/v1/lectures/lectures/",token=token))
assert len(students)==8 and len(lectures)==2
lessons=[]
for lecture in lectures:
    lessons+=rows(call("/api/v1/lectures/sessions/?lecture="+str(lecture["id"]),token=token))
assert len(lessons)==6
attendance=rows(call("/api/v1/lectures/attendance/?session="+str(lessons[0]["id"]),token=token))
assert len(attendance)==4
sample=next(row for row in students if row["name"]=="예시 학생 01")
student_id=sample["id"]
m=f"/api/v1/students/{student_id}/"
call("/api/v1/students/",expected=(401,403))
fake=".".join(token.split(".")[:2]+["A"*43])
call("/api/v1/students/",expected=(401,403),token=fake)
if not protected:
    call("/api/v1/students/",expected=(400,404),token=token,extra={"Host":"unmapped.example.invalid"})
    call("/api/v1/students/",expected=404,token=token,extra={"X-Tenant-Code":"dawon"})
for path in ("/api/v1/students/","/api/v1/staffs/","/api/v1/core/me/","/api/v1/billing/webhooks/reference/",
             "/api/v1/messaging/send/","/api/v1/token/"):
    call(path,expected=(403,404),method="POST",body={},token=token)
call(m,expected=403,method="PATCH",body={"memo":"거절","phone":"01000000000"},token=token)

old=(call(m,token=token).get("memo") or "")
example="합성 원본 비교 검수 예시 메모"
try:
    changed=call(m,method="PATCH",body={"memo":example},token=token)
    assert changed["memo"]==example
    assert call(m,token=token)["memo"]==example
finally:
    call(m,method="PATCH",body={"memo":old},token=token)
assert (call(m,token=token)["memo"] or "")==old
lecture_path=f'/api/v1/lectures/lectures/{lectures[0]["id"]}/'
saved_description=call(lecture_path,token=token).get("description") or ""
try:
    assert call(lecture_path,method="PATCH",body={"description":example},token=token)["description"]==example
    assert call(lecture_path,token=token)["description"]==example
finally:
    call(lecture_path,method="PATCH",body={"description":saved_description},token=token)
assert (call(lecture_path,token=token)["description"] or "")==saved_description
call(lecture_path,expected=403,method="DELETE",token=token)

evidence={"passed":True,"kind":"protected-origin" if protected else "isolated-api",
          "tenantId":849,"referenceUserId":session_id,"referenceStudentId":student_id,
          "counts":{"students":8,"lectures":2,"lessons":6,"sampleAttendance":4},
          "messagingUnconfiguredRead":True,"messagingWriteAndSiblingDenied":True,"validRefreshedTenant":True,"wrongTokenDenied":True,"mutationsScoped":True,
          "nativeMemoSavedReloadedAndRestored":True,"nativeLectureEditRestored":True,"qualifiedNativeReads":list(calls)}
if not protected:
    import django
    django.setup()
    from django.conf import settings
    from apps.core.models import Tenant
    from apps.domains.messaging.models import NotificationLog
    assert settings.DEBUG is False and settings.DATABASES["default"]["HOST"]=="comparison-db"
    assert os.environ.get("AWS_EC2_METADATA_DISABLED")=="true"
    assert list(Tenant.objects.values_list("id","code"))==[(849,"hakwonplus")]
    assert not NotificationLog.objects.exists()
    for target in ("169.254.169.254","198.51.100.1"):
        try:
            with socket.create_connection((target,80),timeout=2):
                raise AssertionError("Unexpected socket egress")
        except OSError:
            pass
    evidence.update(debugDisabled=True,metadataAndExternalConnectionDenied=True,sameDatabaseOnlySynthetic=True,
                    providerReceipts=0,wrongHostDenied=True)
print(json.dumps(evidence))