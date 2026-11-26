"""Seed one contact-free internal notice in the dedicated comparison database."""
import os
import django
django.setup()
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from apps.core.models import Tenant, TenantMembership
from apps.domains.staffs.models import StaffBoardPost

if (os.getenv("HAKWONPLUS_COMPARISON_BOUNDARY")!="isolated-reference-849"
        or settings.DATABASES["default"]["HOST"]!="comparison-db"
        or settings.DATABASES["default"]["NAME"]!="qa_hakwonplus_reference"):
    raise RuntimeError("Reference board seeding requires the dedicated database")
title="학원플러스 원본 비교 안내"
with transaction.atomic():
    tenant=Tenant.objects.select_for_update().get(pk=849,code="hakwonplus")
    admin=get_user_model().objects.get(tenant=tenant,username="comparison-admin",is_active=True)
    assert TenantMembership.objects.filter(tenant=tenant,user=admin,role="admin",is_active=True).exists()
    post,created=StaffBoardPost.objects.get_or_create(
        tenant=tenant,author=admin,category=StaffBoardPost.Category.NOTICE,title=title,
        defaults={"author_name":admin.name,"body":"여기는 학원플러스 원본의 합성 데이터 체험 화면입니다. 학생 명단과 강의를 보고 교직원 공지를 작성해 보세요."},
    )
print(f"reference_board_seed_created={int(created)} notice_id={post.pk}")