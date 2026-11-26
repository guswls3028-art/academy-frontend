"""Populate only the disposable, isolated HakwonPlus comparison database."""
import os
from datetime import timedelta

import django
django.setup()

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection, models, transaction
from django.utils import timezone

from apps.core.models import Tenant, TenantDomain, TenantMembership
from apps.domains.attendance.models import Attendance
from apps.domains.enrollment.models import Enrollment, SessionEnrollment
from apps.domains.lectures.models import Lecture, Session
from apps.domains.students.models import Student
from apps.domains.staffs.models import Staff

TENANT_ID = 849
TENANT_CODE = "hakwonplus"
ADMIN_USERNAME = "comparison-admin"
REFERENCE_HOST = "reference.hakwonplus.localhost"
REFERENCE_NAME = "학원플러스 원본 비교"
if os.environ.get("HAKWONPLUS_COMPARISON_BOUNDARY") != "isolated-reference-849":
    raise RuntimeError("Exact isolated reference fixture operation required")
database = settings.DATABASES["default"]
if (database["ENGINE"]!="django.db.backends.postgresql" or database["NAME"]!="qa_hakwonplus_reference"
        or database["HOST"]!="comparison-db" or getattr(settings,"DAWON_REVIEW_CLASS_GROUPS",False)):
    raise RuntimeError("Comparison fixture is restricted to its dedicated PostgreSQL database")
if Tenant.objects.exclude(pk=TENANT_ID).exists():
    raise RuntimeError("Unexpected tenant in the reference database")
password = os.environ["COMPARISON_ADMIN_PASSWORD"]
if len(password) < 24:
    raise RuntimeError("The synthetic login requires a randomly generated password")

with transaction.atomic():
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [849003718])
    candidates = list(Tenant.objects.filter(models.Q(pk=TENANT_ID) | models.Q(code=TENANT_CODE)))
    domains = TenantDomain.objects.filter(host__in=(REFERENCE_HOST,"www."+REFERENCE_HOST))
    if candidates:
        if len(candidates) != 1 or (candidates[0].pk,candidates[0].code,candidates[0].name) != (TENANT_ID,TENANT_CODE,REFERENCE_NAME):
            raise RuntimeError("Reference tenant identifiers are already assigned")
        tenant = candidates[0]
        assert domains.count() == 2 and not domains.exclude(tenant=tenant).exists()
        user = get_user_model().objects.get(tenant=tenant,username=ADMIN_USERNAME)
        assert user.is_active and not user.is_staff and not user.is_superuser and user.check_password(password)
        assert TenantMembership.objects.filter(tenant=tenant,user=user,role="admin",is_active=True).exists()
        assert Student.objects.filter(tenant=tenant,ps_number__startswith="REF-").count() == 8
        assert Lecture.objects.filter(tenant=tenant).count() == 2
        assert Session.objects.filter(lecture__tenant=tenant).count() == 6
        assert Attendance.objects.filter(tenant=tenant).count() == 24
        assert Staff.objects.filter(tenant=tenant,user=user,name="체험 관리자").count() == 1
        print("Existing exact synthetic reference fixture validated; no writes.")
        raise SystemExit(0)
    if domains.exists():
        raise RuntimeError("Reference domain is already assigned")
    call_command("provision_tenant",TENANT_CODE,tenant_id=TENANT_ID,name=REFERENCE_NAME,domain=REFERENCE_HOST,
                 login_title="학원플러스",window_title="학원플러스",verbosity=0)
    tenant = Tenant.objects.get(pk=TENANT_ID,code=TENANT_CODE)
    users = get_user_model()
    admin = users.objects.create_user(tenant=tenant,username=ADMIN_USERNAME,password=password,
                                      name="체험 관리자",must_change_password=False,
                                      first_login_guide_completed_at=timezone.now())
    TenantMembership.ensure_active(tenant=tenant,user=admin,role="admin")
    Staff.objects.create(tenant=tenant,user=admin,name="체험 관리자",phone="",position="INSTRUCTOR")
    start = timezone.localdate() - timedelta(days=1)
    students = []
    for index in range(1,9):
        name = f"예시 학생 {index:02d}"
        login = users.objects.create_user(tenant=tenant,username=f"comparison-student-{index:02d}",
                                          name=name,password=None)
        TenantMembership.ensure_active(tenant=tenant,user=login,role="student")
        students.append(Student.objects.create(tenant=tenant,user=login,name=name,ps_number=f"REF-{index:02d}",
                                                omr_code=f"880000{index:02d}",grade=(index-1)%3+1,
                                                school_type="HIGH",high_school="예시고등학교",memo=""))
    for index,(name,chip,color) in enumerate((("공통수학 정규반","공수","#3158d4"),("대수 심화반","대수","#7c3aed"))):
        lecture = Lecture.objects.create(tenant=tenant,title=name,name=name,subject="MATH",color=color,
                                         chip_label=chip,lecture_time="월·수 18:00",is_active=True)
        sessions = [Session.objects.create(lecture=lecture,order=n,regular_order=n,
                                           title=f"{n}차시 수업",date=start+timedelta(days=n-1),
                                           session_type=Session.SessionType.REGULAR) for n in (1,2,3)]
        for student in students[index*4:(index+1)*4]:
            enrollment = Enrollment.objects.create(tenant=tenant,student=student,lecture=lecture,status="ACTIVE")
            for session in sessions:
                SessionEnrollment.objects.create(tenant=tenant,enrollment=enrollment,session=session)
                status = ("PRESENT","LATE","ABSENT","UNSET")[(student.grade+session.order)%4]
                Attendance.objects.create(tenant=tenant,enrollment=enrollment,session=session,status=status)
print("Seeded one synthetic comparison admin, eight synthetic students, two lectures, six lessons, and 24 attendance records.")