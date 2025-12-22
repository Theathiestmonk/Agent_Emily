"""
Shared logic for assembling the Meta OAuth scope list.

Some scopes (for example `pages_public_metadata_access`) require App Review or
feature approval before they can be requested. The helper below lets us toggle
those additional scopes from the environment so we only request them once the
app is ready, and avoid hitting the "Invalid scope" dialog in Firefox/Chrome.
"""
from __future__ import annotations

import os
from typing import List


BASE_META_OAUTH_SCOPES: List[str] = [
    "pages_manage_metadata",
    "pages_messaging",
    "pages_manage_engagement",
    "instagram_manage_comments",
    "instagram_manage_messages",
    "instagram_public_content_access",
    "ads_management_standard_access",
    "pages_read_engagement",
    "pages_show_list",
    "instagram_basic",
    "ads_management",
    "ads_read",
    "instagram_content_publish",
    "business_management",
    "pages_manage_posts",
    "read_insights",
    "whatsapp_business_management",
    "instagram_business_manage_insights",
    "instagram_business_content_publish",
    "pages_manage_ads",
    "instagram_manage_insights",
    "leads_retrieval",
    "page_events",
]

OPTIONAL_META_OAUTH_SCOPES: List[str] = [
    "pages_public_metadata_access",
    "pages_public_content_access",
    "whatsapp_business_manage_events",
    "instagram_manage_upcoming_events",
    "instagram_branded_content_ads_brand",
    "instagram_manage_events",
    "meta_oembed_read",
    "instagram_business_manage_messages",
    "instagram_business_manage_comments",
    "whatsapp_business_messaging",
    "page_mentions",
]


def _include_optional_scopes() -> bool:
    flag = os.getenv("FACEBOOK_ENABLE_PUBLIC_SCOPES", "").strip().lower()
    return flag in {"1", "true", "yes", "on"}


def get_meta_oauth_scopes() -> List[str]:
    """Return the Meta scope list we should request right now."""
    scopes = BASE_META_OAUTH_SCOPES.copy()

    if _include_optional_scopes():
        scopes.extend(OPTIONAL_META_OAUTH_SCOPES)

    return scopes


def get_meta_scope_string() -> str:
    """Return the comma-delimited scope string for OAuth URLs."""
    return ",".join(get_meta_oauth_scopes())


