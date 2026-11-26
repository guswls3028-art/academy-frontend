"""Issue a standard password-authenticated token for the one synthetic admin."""
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from apps.api.common.auth_jwt import TenantAwareTokenObtainPairSerializer, TenantAwareTokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from apps.core.models import TenantMembership


class ReferenceSessionThrottle(AnonRateThrottle):
    rate = "60/min"
    cache_format = "reference_session_%(ident)s"


class ReferenceSession(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ReferenceSessionThrottle]

    def post(self,request):
        tenant = getattr(request,"tenant",None)
        if (request.get_host() != "reference.hakwonplus.localhost" or not tenant
                or (tenant.pk,tenant.code)!=(849,"hakwonplus") or request.body or request.query_params):
            raise NotFound()
        user=get_user_model().objects.filter(
            tenant=tenant,username="comparison-admin",is_active=True,is_staff=False,is_superuser=False,
        ).first()
        if not user or not TenantMembership.objects.filter(tenant=tenant,user=user,role="admin",is_active=True).exists():
            raise NotFound()
        serializer=TenantAwareTokenObtainPairSerializer(
            data={"username":"comparison-admin","password":settings.COMPARISON_ADMIN_PASSWORD},
            context={"request":request},
        )
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data,headers={"Cache-Control":"private, no-store"})
class ReferenceRefresh(TenantAwareTokenRefreshView):
    def post(self,request,*args,**kwargs):
        if request.get_host()!="reference.hakwonplus.localhost" or set(request.data)!={"refresh"}:
            raise NotFound()
        value=request.data.get("refresh")
        if not isinstance(value,str) or len(value)>8192:
            raise NotFound()
        try:
            token=RefreshToken(value)
        except TokenError:
            raise NotFound()
        user=get_user_model().objects.filter(
            tenant_id=849,tenant__code="hakwonplus",username="comparison-admin",
            is_active=True,is_staff=False,is_superuser=False,
        ).first()
        if (not user or token.get("tenant_id")!=849 or str(token.get("user_id"))!=str(user.pk)
                or not TenantMembership.objects.filter(tenant_id=849,user=user,role="admin",is_active=True).exists()):
            raise NotFound()
        response=super().post(request,*args,**kwargs)
        if response.status_code==200:
            response["X-Tenant-Id"]="849"
            response["Cache-Control"]="private, no-store"
        return response