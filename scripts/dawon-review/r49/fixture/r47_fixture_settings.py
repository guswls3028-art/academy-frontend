"""GitHub runner-only settings for the sealed R47 disposable fixture."""
import os
import socket

from apps.api.config.settings.test_pg import *  # noqa: F401,F403
from apps.api.config.settings.base import REST_FRAMEWORK as BASE_REST_FRAMEWORK

if os.getenv("R47_QA_HOSTED") != "1":
    raise RuntimeError("Hosted R47 fixture startup required")
if DATABASES["default"]["NAME"] != "qa_r47" or DATABASES["default"]["HOST"] != "qa-r47-db":
    raise RuntimeError("Only the disposable R47 database is accepted")
for alias in ("qa-r47-db", "review-moto", "review-redis"):
    if socket.gethostbyname(alias) != "127.0.0.1":
        raise RuntimeError(f"R47 fixture requires a loopback alias for {alias}")

DAWON_REVIEW_CLASS_GROUPS = True
ALLOWED_HOSTS = ["dawon.localhost", "127.0.0.1", "localhost"]
TENANT_HEADER_CODE_ALLOWED_HOSTS = ["dawon.localhost", "127.0.0.1", "localhost"]
REST_FRAMEWORK = {
    **BASE_REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {
        **BASE_REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
        "anon": "180/min",
    },
}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.PBKDF2PasswordHasher"]
CACHES = {"default": {"BACKEND": "django.core.cache.backends.redis.RedisCache",
                      "LOCATION": "redis://review-redis:6379/0"}}
TOOLS_SQS_QUEUE_NAME = "dawon-review-tools"
R2_ENDPOINT = "http://review-moto:5000"
R2_REGION = "us-east-1"
R2_PUBLIC_BASE_URL = R2_ENDPOINT
R2_ACCESS_KEY = os.environ["AWS_ACCESS_KEY_ID"]
R2_SECRET_KEY = os.environ["AWS_SECRET_ACCESS_KEY"]
R2_EXCEL_BUCKET = "dawon-review-excel"