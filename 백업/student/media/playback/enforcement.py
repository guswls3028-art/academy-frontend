from django.conf import settings

def enforcement_mode() -> str:
    return getattr(settings, "MEDIA_PLAYBACK_ENFORCEMENT_MODE", "disabled")

def enforcement_enabled() -> bool:
    return enforcement_mode() != "disabled"
