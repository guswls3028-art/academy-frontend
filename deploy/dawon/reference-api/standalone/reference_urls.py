from django.urls import path

from apps.api.config.urls import urlpatterns as native_urls
from reference_session import ReferenceRefresh, ReferenceSession

urlpatterns = [
    path("api/v1/reference/session/",ReferenceSession.as_view(),name="isolated-reference-session"),
    path("api/v1/token/refresh/",ReferenceRefresh.as_view(),name="isolated-reference-refresh"),
    *native_urls,
]