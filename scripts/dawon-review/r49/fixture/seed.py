"""Only for the disposable R47 staff QA database on its private network."""
from datetime import time, timedelta

import django
django.setup()
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from apps.core.models import Tenant, TenantMembership
from apps.domains.attendance.models import Attendance
from apps.domains.enrollment.models import Enrollment, SessionEnrollment
from apps.domains.lectures.models import Lecture, Session
from apps.domains.staffs.models import Staff, StaffWorkType, WorkRecord, WorkType
from apps.domains.students.services.dawon_staff import EMPLOYEE, FIXTURES, WORK_MARK, WORK_TYPE
from apps.domains.students.models import Student, ClassGroup, ClassGroupLecture
from apps.domains.teachers.models import Teacher

db = settings.DATABASES["default"]
assert db["NAME"] == "qa_r47" and db["HOST"] == "qa-r47-db"
with transaction.atomic():
    t = Tenant.objects.get(id=719, code="dawon")
    assert not ClassGroup.objects.filter(tenant=t).exists()
    if not __debug__ or db["NAME"] != "qa_r47" or db["HOST"] != "qa-r47-db" or Student.objects.exists():
        raise RuntimeError("Expected empty isolated R47 student database")
    from apps.domains.parents.models import Parent
    from apps.domains.parents.services import parent_account_username
    from django.core.management import call_command
    from apps.support.results.school_reports import SchoolReportTerm, save_direct_scores
    parent_phone = "01000000002"
    guardian = get_user_model().objects.create_user(tenant=t, username=parent_account_username(tenant=t,parent_phone=parent_phone),password=None)
    guardian.first_login_guide_completed_at = timezone.now()
    guardian.save(update_fields=["first_login_guide_completed_at"])
    TenantMembership.ensure_active(tenant=t,user=guardian,role="parent")
    parent = Parent.objects.create(tenant=t,user=guardian,name="QA-R47 보호자",phone=parent_phone)
    learner = get_user_model().objects.create_user(tenant=t,username="qa-r47-report-learner",password=None)
    learner.first_login_guide_completed_at = timezone.now()
    learner.save(update_fields=["first_login_guide_completed_at"])
    TenantMembership.ensure_active(tenant=t,user=learner,role="student")
    # Use normal generated PKs to preserve the PostgreSQL sequence and the public demo's pk=2 requirement.
    reserved = get_user_model().objects.create_user(tenant=t,username="qa-r47-reserved",password=None)
    first = Student.objects.create(tenant=t,user=reserved,name="QA-R47 예비",ps_number="qa-r47-reserved",omr_code="90000001")
    sample = Student.objects.create(tenant=t,user=learner,parent=parent,name="다원 수업 검수 학생 2",
        ps_number="qa-r47-report",omr_code="90000002",school_type="HIGH",high_school="검수고",grade=1)
    if (first.pk,sample.pk)!=(1,2):
        raise RuntimeError("Unexpected fresh isolated primary keys")
    report_group=ClassGroup.objects.create(tenant=t,name="하이퍼1",kind="union",track="HYPER")
    for title,term,school in [("HYPER 방학 수학Ⅱ","vacation",""),("QA-R47 학교 중간","midterm",sample.high_school)]:
        lec=Lecture.objects.create(tenant=t,title=title,name="QA-R47 강사",subject="수학",color="#415a87",chip_label="심화")
        ClassGroupLecture.objects.create(group=report_group,lecture=lec,period=term,school=school)
    call_command("seed_dawon_reports",verbosity=0)
    from django.db.models import F
    Session.objects.filter(lecture__class_group_link__group=report_group).update(date=F("date")-timedelta(days=14))
    for term,mark in [("first",0),("second",85)]:
        save_direct_scores(t,sample,learner,SchoolReportTerm(timezone.localdate().year,1,term),[{"subject":"수학","score":mark,"max_score":100}])
    staff = {}
    for role in ("admin", "teacher"):
        user = get_user_model().objects.create_user(username="t719_dawon-demo-"+role, password=None,
                                                     tenant=t, name="QA-R47 "+role, must_change_password=False,
                                                     first_login_guide_completed_at=timezone.now())
        TenantMembership.ensure_active(tenant=t, user=user, role=role)
        staff[role] = user
    teacher = staff["teacher"]
    Teacher.objects.create(tenant=t, name=teacher.name, subject="수학")
    Staff.objects.create(tenant=t, user=teacher, name=teacher.name, position="INSTRUCTOR")
    home = ClassGroup.objects.create(tenant=t, name="QA-R47 출결반", kind="union", track="SKY", assigned_teacher=teacher)
    course = Lecture.objects.create(tenant=t, title="QA-R47 수학", name=teacher.name, subject="수학", start_date=timezone.localdate(), lecture_time="13:00~15:00")
    ClassGroupLecture.objects.create(group=home, lecture=course, period="vacation", reference_teacher=teacher)
    today = timezone.localdate()
    sessions = [Session.objects.create(lecture=course, order=i, title=f"QA-R47 수업 {i}", date=today) for i in (1, 2)]
    previous = Session.objects.create(lecture=course, order=3, title="QA-R47 34명 명단", date=today - timedelta(days=1))
    for n in range(1, 35):
        user = get_user_model().objects.create_user(username=f"qa-r47-{n}", password=None, tenant=t, name=f"QA-R47 학생 {n}")
        pupil = Student.objects.create(tenant=t, user=user, name=user.name, ps_number=f"qa-r47-{n}", omr_code=f"{n:08}")
        TenantMembership.ensure_active(tenant=t,user=user,role="student")
        home.students.add(pupil)
        enrollment = Enrollment.objects.create(tenant=t, student=pupil, lecture=course)
        SessionEnrollment.objects.create(tenant=t, enrollment=enrollment, session=previous)
        Attendance.objects.create(tenant=t, enrollment=enrollment, session=previous, status="PRESENT")
        if n > 3:
            continue
        for session in sessions:
            SessionEnrollment.objects.create(tenant=t, enrollment=enrollment, session=session)
            if n != 3:
                Attendance.objects.create(tenant=t, enrollment=enrollment, session=session,
                                          status="UNSET" if n == 1 else "ABSENT")
    candidate = get_user_model().objects.create_user(tenant=t,username="qa-r47-pick-student",password=None,name="QA-R47 학생 등록검수")
    TenantMembership.ensure_active(tenant=t,user=candidate,role="student")
    Student.objects.create(tenant=t,user=candidate,name=candidate.name,ps_number="qa-r47-picker",omr_code="94000001",school_type="HIGH",high_school="검수고",grade=1)
    history = get_user_model().objects.create_user(
        tenant=t, username="qa-r47-former-enrollee", password=None, name="QA-R47 학생 이전수강"
    )
    TenantMembership.ensure_active(tenant=t, user=history, role="student")
    former = Student.objects.create(
        tenant=t, user=history, name=history.name, ps_number="qa-r47-former-enrollee",
        omr_code="94000002", school_type="HIGH", high_school="검수고", grade=1,
    )
    home.students.add(former)
    Enrollment.objects.create(tenant=t, student=former, lecture=course, status="INACTIVE")
    payroll_person = get_user_model().objects.create_user(
        tenant=t, username=EMPLOYEE, name=FIXTURES[EMPLOYEE][0], password=None,
    )
    TenantMembership.ensure_active(tenant=t,user=payroll_person,role="staff")
    payroll_staff = Staff.objects.create(
        tenant=t, user=payroll_person, name=payroll_person.name, phone="", position=FIXTURES[EMPLOYEE][1],
    )
    work_type = WorkType.objects.create(tenant=t,name=WORK_TYPE,description=WORK_MARK,base_hourly_wage=20000)
    StaffWorkType.objects.create(tenant=t,staff=payroll_staff,work_type=work_type)
    for day in (today.replace(day=1), today.replace(day=1) - timedelta(days=1)):
        WorkRecord.objects.create(tenant=t,staff=payroll_staff,work_type=work_type,date=day,
                                  start_time=time(13),end_date=day,end_time=time(15),memo=WORK_MARK)
    print(f"R47 browser fixture ids group={home.pk} lecture={course.pk} payroll_staff={payroll_staff.pk}")
print("Synthetic R47 class, two current lessons and previous 34-person lesson prepared.")
