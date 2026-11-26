"""Dedicated, non-production HakwonPlus reference settings."""
from os import environ

from apps.api.config.settings.test_pg import *  # noqa: F401,F403
from apps.api.config.settings.base import REST_FRAMEWORK as STANDARD_REST_FRAMEWORK

if environ.get("HAKWONPLUS_COMPARISON_BOUNDARY") != "isolated-reference-849":
    raise RuntimeError("Reference runtime only")
if DATABASES["default"]["NAME"] != "qa_hakwonplus_reference" or DATABASES["default"]["HOST"] != "comparison-db":
    raise RuntimeError("Reference database only")
if len(environ["COMPARISON_SIGNING_KEY"]) < 48 or len(environ["COMPARISON_ADMIN_PASSWORD"]) < 32:
    raise RuntimeError("Independent reference credentials required")

DEBUG = False
SECRET_KEY = environ["COMPARISON_SIGNING_KEY"]
SIMPLE_JWT = {**SIMPLE_JWT,"SIGNING_KEY":SECRET_KEY,"AUDIENCE":"hakwonplus-reference-849",
              "ISSUER":"original-demo.hakwonplus.com"}
ALLOWED_HOSTS = ["reference.hakwonplus.localhost","localhost","127.0.0.1"]
TENANT_HEADER_CODE_ALLOWED_HOSTS = ()
ROOT_URLCONF = "reference_urls"
MIDDLEWARE = ["reference_boundary.ReferenceBoundary", *MIDDLEWARE]
REST_FRAMEWORK = {**STANDARD_REST_FRAMEWORK,"DEFAULT_THROTTLE_RATES":{
    **STANDARD_REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],"anon":"180/min"
}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.PBKDF2PasswordHasher"]
CACHES = {"default":{"BACKEND":"django.core.cache.backends.redis.RedisCache",
                     "LOCATION":"redis://comparison-cache:6379/0"}}
DAWON_REVIEW_CLASS_GROUPS = False
SECURE_SSL_REDIRECT = False
BILLING_TEST_BYPASS_SUBSCRIPTION = True
SOLAPI_API_KEY = ""
SOLAPI_API_SECRET = ""
EMAIL_BACKEND = "django.core.mail.backends.dummy.EmailBackend"
R2_ENDPOINT = "http://comparison-disabled.invalid"
R2_PUBLIC_BASE_URL = ""
AWS_EC2_METADATA_DISABLED = True
COMPARISON_ADMIN_PASSWORD = environ["COMPARISON_ADMIN_PASSWORD"]