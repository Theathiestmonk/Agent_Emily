"""
Google Drive Monitor — polls user's 'Emily' Drive folder for new files,
auto-detects date/time in subfolder names, generates captions using the
ContentFromDriveAgent (Emily + Leo), and schedules posts intelligently.

Folder structure Emily understands:
  Emily/                          ← root, watched every 5 min
    ├── image.jpg                 ← immediate post (no scheduled date)
    ├── 2026-02-24/              ← all files in this folder → posted on 24 Feb
    │     ├── pic1.jpg           ← post 1 at best time slot
    │     └── pic2.jpg           ← post 2 staggered 2-4 h later
    ├── monday 9am/              ← next Monday at 09:00
    ├── tomorrow/                ← tomorrow at best engagement time
    ├── facebook/                ← platform-specific folder (legacy, still supported)
    └── 24 feb 3pm/             ← 24 Feb at 15:00
"""

import os
import re
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Tuple

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
from cryptography.fernet import Fernet

load_dotenv()

logger = logging.getLogger(__name__)

# ── Supabase clients ──────────────────────────────────────────────────────────
supabase_url      = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
supabase_svc_key  = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_anon_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

supabase: Client       = create_client(supabase_url, supabase_anon_key)
supabase_admin: Client = create_client(supabase_url, supabase_svc_key or supabase_anon_key)

# ── Router ────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/drive", tags=["drive-monitor"])

# ── Supported MIME types ──────────────────────────────────────────────────────
SUPPORTED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic",
    "video/mp4", "video/quicktime", "video/x-msvideo",
    "application/pdf",
    "application/vnd.google-apps.document",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

# Best engagement times per platform (hour in 24h, local naive — stored as UTC offset later)
PLATFORM_BEST_HOURS = {
    "instagram":  [9, 12, 17, 19],
    "facebook":   [9, 13, 15, 18],
    "twitter":    [8, 12, 17, 20],
    "linkedin":   [8, 10, 12, 17],
    "pinterest":  [8, 21],
    "tiktok":     [6, 10, 19, 21],
    "wordpress":  [9, 13],
    "default":    [9, 12, 17, 19],
}

WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
    "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
}

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "september": 9, "oct": 10, "october": 10,
    "nov": 11, "november": 11, "dec": 12, "december": 12,
}

# ── Crypt helpers ─────────────────────────────────────────────────────────────

def _get_fernet() -> Fernet:
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="ENCRYPTION_KEY not configured")
    return Fernet(key.encode())


def _encrypt(value: str) -> str:
    return _get_fernet().encrypt(value.encode()).decode()


def _decrypt(value: str) -> str:
    return _get_fernet().decrypt(value.encode()).decode()


# ── Auth ──────────────────────────────────────────────────────────────────────

def _get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        resp = supabase.auth.get_user(token)
        if not resp or not resp.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": resp.user.id, "email": resp.user.email}
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Auth error: {exc}")


# ── Drive connection helpers ──────────────────────────────────────────────────

def _get_drive_connection(user_id: str) -> Optional[dict]:
    """Fetch active google_drive row from user_connections OR fall back to google platform_connections."""
    # First try dedicated drive connection
    result = (
        supabase_admin.table("user_connections")
        .select("*")
        .eq("user_id", user_id)
        .eq("service", "google_drive")
        .eq("is_active", True)
        .execute()
    )
    if result.data:
        return result.data[0]

    # Fall back: reuse platform_connections google entry
    result2 = (
        supabase_admin.table("platform_connections")
        .select("*")
        .eq("user_id", user_id)
        .eq("platform", "google")
        .eq("is_active", True)
        .execute()
    )
    if result2.data:
        conn = result2.data[0]
        # Normalise field names to match user_connections schema
        conn.setdefault("access_token_encrypted", conn.get("access_token_encrypted") or conn.get("access_token"))
        conn.setdefault("refresh_token_encrypted", conn.get("refresh_token_encrypted") or conn.get("refresh_token"))
        conn.setdefault("metadata", {})
        conn["_source"] = "platform_connections"
        return conn
    return None


def _refresh_credentials(conn: dict, user_id: str):
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    try:
        access_token  = _decrypt(conn["access_token_encrypted"])
        refresh_token = _decrypt(conn["refresh_token_encrypted"]) if conn.get("refresh_token_encrypted") else None
    except Exception:
        # Maybe tokens aren't encrypted in platform_connections
        access_token  = conn.get("access_token_encrypted") or conn.get("access_token", "")
        refresh_token = conn.get("refresh_token_encrypted") or conn.get("refresh_token")

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    )

    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            update_payload = {
                "access_token_encrypted": _encrypt(creds.token),
                "token_expires_at": creds.expiry.isoformat() if creds.expiry else None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if creds.refresh_token:
                update_payload["refresh_token_encrypted"] = _encrypt(creds.refresh_token)

            if conn.get("_source") == "platform_connections":
                supabase_admin.table("platform_connections").update(update_payload).eq("id", conn["id"]).execute()
            else:
                supabase_admin.table("user_connections").update(update_payload).eq("id", conn["id"]).execute()
            logger.info(f"Drive tokens refreshed for user {user_id}")
        except Exception as e:
            logger.error(f"Token refresh failed for user {user_id}: {e}")
            if conn.get("_source") != "platform_connections":
                supabase_admin.table("user_connections").update({
                    "is_active": False,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", conn["id"]).execute()
            raise HTTPException(
                status_code=401,
                detail="Google Drive token expired and could not be refreshed. Please reconnect."
            )

    return creds


def _build_drive_service(creds):
    from googleapiclient.discovery import build
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _find_emily_folder(service) -> Optional[str]:
    for name in ("Emily", "emily", "EMILY"):
        q = f"name='{name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        resp = service.files().list(q=q, fields="files(id,name)", pageSize=10).execute()
        files = resp.get("files", [])
        if files:
            return files[0]["id"]
    return None


# ── Smart date/time parser for folder names ───────────────────────────────────

def _parse_folder_date(folder_name: str) -> Optional[datetime]:
    """
    Attempt to extract a target datetime from a Drive subfolder name.
    Understands formats like:
      2026-02-24           → Feb 24 at best-hour
      2026-02-24 3pm       → Feb 24 15:00
      24 feb               → Feb 24 this/next year
      24 feb 9am           → Feb 24 09:00
      monday               → next Monday
      monday 9am           → next Monday 09:00
      tomorrow             → tomorrow
      tomorrow 3pm         → tomorrow 15:00
      next week            → 7 days from now
    Returns None if no date can be parsed (folder will use immediate scheduling).
    """
    now = datetime.now(timezone.utc)
    name = folder_name.strip().lower()

    # --- extract optional time like "3pm", "9:30am", "15:00" ---
    hour, minute = None, 0
    time_patterns = [
        (r'(\d{1,2}):(\d{2})\s*(am|pm)', True),   # 9:30am / 3:00pm
        (r'(\d{1,2})\s*(am|pm)',           False),  # 9am / 3pm
        (r'(\d{2}):(\d{2})',               False),  # 15:00 (24h)
    ]
    clean_name = name
    for pat, has_min in time_patterns:
        m = re.search(pat, name)
        if m:
            h = int(m.group(1))
            mn = int(m.group(2)) if has_min else 0
            ampm = m.group(3) if has_min else (m.group(2) if not has_min and len(m.groups()) >= 2 else None)
            if ampm == "pm" and h != 12:
                h += 12
            elif ampm == "am" and h == 12:
                h = 0
            hour, minute = h, mn
            clean_name = re.sub(pat, "", clean_name).strip(" _-")
            break

    def _with_time(dt: datetime) -> datetime:
        if hour is not None:
            return dt.replace(hour=hour, minute=minute, second=0, microsecond=0, tzinfo=timezone.utc)
        # default: 9am UTC
        return dt.replace(hour=9, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)

    # --- relative keywords ---
    if "tomorrow" in clean_name:
        return _with_time(now + timedelta(days=1))

    if "next week" in clean_name:
        return _with_time(now + timedelta(weeks=1))

    if "today" in clean_name:
        candidate = _with_time(now)
        if candidate <= now:
            candidate += timedelta(hours=3)
        return candidate

    # --- weekday names ---
    for day_name, day_num in WEEKDAYS.items():
        if day_name in clean_name.split():
            days_ahead = (day_num - now.weekday()) % 7
            if days_ahead == 0:
                days_ahead = 7  # always pick NEXT occurrence
            return _with_time(now + timedelta(days=days_ahead))

    # --- ISO date YYYY-MM-DD ---
    m = re.search(r'(\d{4})-(\d{2})-(\d{2})', clean_name)
    if m:
        try:
            dt = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
            return _with_time(dt)
        except ValueError:
            pass

    # --- DD-MM-YYYY or DD/MM/YYYY ---
    m = re.search(r'(\d{1,2})[-/](\d{1,2})[-/](\d{4})', clean_name)
    if m:
        try:
            dt = datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)), tzinfo=timezone.utc)
            return _with_time(dt)
        except ValueError:
            pass

    # --- "24 feb" or "feb 24" ---
    for mon_name, mon_num in MONTHS.items():
        # "24 feb" or "24 february"
        m = re.search(rf'(\d{{1,2}})\s+{mon_name}', clean_name)
        if m:
            day = int(m.group(1))
            year = now.year
            try:
                dt = datetime(year, mon_num, day, tzinfo=timezone.utc)
                if dt < now:
                    dt = datetime(year + 1, mon_num, day, tzinfo=timezone.utc)
                return _with_time(dt)
            except ValueError:
                pass
        # "feb 24"
        m = re.search(rf'{mon_name}\s+(\d{{1,2}})', clean_name)
        if m:
            day = int(m.group(1))
            year = now.year
            try:
                dt = datetime(year, mon_num, day, tzinfo=timezone.utc)
                if dt < now:
                    dt = datetime(year + 1, mon_num, day, tzinfo=timezone.utc)
                return _with_time(dt)
            except ValueError:
                pass

    return None


def _compute_schedule_slots(
    base_dt: Optional[datetime],
    file_count: int,
    platform: str,
) -> List[datetime]:
    """
    Given a base date (or None = ASAP) and a number of files,
    return a list of scheduled_at datetimes spread across best-engagement hours.
    Multiple files in the same folder get staggered by 2-4 hours minimum.
    """
    now = datetime.now(timezone.utc)
    best_hours = PLATFORM_BEST_HOURS.get(platform.lower(), PLATFORM_BEST_HOURS["default"])

    if base_dt is None:
        # No date hint — schedule starting from next good hour today/tomorrow
        base_date = now
    else:
        base_date = base_dt

    slots: List[datetime] = []
    candidate_hours = sorted(best_hours)

    # Build a pool of candidate slots from base_date onward (up to 3 days)
    candidate_slots = []
    for day_offset in range(4):
        day = base_date + timedelta(days=day_offset)
        for h in candidate_hours:
            slot = day.replace(hour=h, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            if slot > now + timedelta(minutes=10):
                candidate_slots.append(slot)

    # If user specified an explicit time (base_dt with non-9:00 hour), honour it first
    if base_dt and base_dt.hour != 9:
        candidate_slots.insert(0, base_dt)

    # Pick `file_count` slots at least 2 hours apart
    MIN_GAP = timedelta(hours=2)
    for slot in candidate_slots:
        if len(slots) >= file_count:
            break
        if not slots or (slot - slots[-1]) >= MIN_GAP:
            slots.append(slot)

    # Safety: fill remaining with +3h gaps from last slot
    while len(slots) < file_count:
        last = slots[-1] if slots else now
        slots.append(last + timedelta(hours=3))

    return slots[:file_count]


# ── Drive file helpers ────────────────────────────────────────────────────────

def _list_subfolders(service, parent_id: str) -> List[dict]:
    """Return immediate child folders of parent_id."""
    q = f"'{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    resp = service.files().list(q=q, fields="files(id,name)", pageSize=200).execute()
    return resp.get("files", [])


def _list_files_in_folder(service, folder_id: str) -> List[dict]:
    """Return all supported files directly inside folder_id (non-recursive)."""
    results = []
    page_token = None
    while True:
        q = f"'{folder_id}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'"
        kwargs = dict(q=q, fields="nextPageToken,files(id,name,mimeType,webContentLink,webViewLink,thumbnailLink)", pageSize=100)
        if page_token:
            kwargs["pageToken"] = page_token
        resp = service.files().list(**kwargs).execute()
        for f in resp.get("files", []):
            if f.get("mimeType", "") in SUPPORTED_MIME_TYPES:
                results.append(f)
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return results


def _is_processed(user_id: str, file_id: str) -> bool:
    r = supabase_admin.table("drive_processed_files") \
        .select("drive_file_id") \
        .eq("user_id", user_id) \
        .eq("drive_file_id", file_id) \
        .execute()
    return bool(r.data)


def _mark_processed(user_id: str, file_id: str, file_name: str, mime_type: str,
                    status: str = "processed", error: str = None):
    supabase_admin.table("drive_processed_files").upsert({
        "user_id": user_id,
        "drive_file_id": file_id,
        "file_name": file_name,
        "mime_type": mime_type,
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "error_message": error,
    }, on_conflict="user_id,drive_file_id").execute()


def _get_connected_platforms(user_id: str) -> List[str]:
    result = supabase_admin.table("platform_connections") \
        .select("platform") \
        .eq("user_id", user_id) \
        .eq("is_active", True) \
        .execute()
    return [row["platform"] for row in (result.data or [])]


def _get_business_context(user_id: str) -> dict:
    """Fetch user's business profile for richer caption generation."""
    try:
        r = supabase_admin.table("profiles").select(
            "business_name,business_description,brand_tone,industry,target_audience,brand_voice"
        ).eq("id", user_id).execute()
        if r.data:
            return r.data[0]
    except Exception:
        pass
    return {}


# ── Caption generation (Emily + Leo) ─────────────────────────────────────────

def _generate_caption(
    file_name: str,
    mime_type: str,
    platform: str,
    business_context: dict,
    folder_context: str = "",
) -> str:
    """
    Generate a rich, brand-aware social media caption using Emily (GPT-4o-mini).
    Includes business context and optional folder name as creative hint.
    Falls back to a simple caption if the API call fails.
    """
    import openai
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    biz_name  = business_context.get("business_name") or "our brand"
    biz_desc  = business_context.get("business_description") or ""
    tone      = business_context.get("brand_tone") or "professional and engaging"
    industry  = business_context.get("industry") or ""
    audience  = business_context.get("target_audience") or "our audience"
    voice     = business_context.get("brand_voice") or tone

    media_type = "image" if mime_type.startswith("image/") else "video" if mime_type.startswith("video/") else "post"
    context_hint = f'\nContent theme/context from folder name: "{folder_context}"' if folder_context else ""

    platform_instructions = {
        "instagram": "Use emojis naturally. End with 5-8 relevant hashtags. Keep caption punchy (under 150 chars before hashtags).",
        "facebook":  "Conversational and warm. Encourage engagement with a question or CTA. 1-3 hashtags max.",
        "linkedin":  "Professional insight. Tell a brief story or share a value. 1-2 hashtags.",
        "twitter":   "Ultra-concise (under 240 chars). Punchy hook + 1-2 hashtags.",
        "wordpress": "Write 2-3 engaging paragraphs. No hashtags needed. SEO-friendly intro.",
        "tiktok":    "High-energy, trend-aware caption. Short + 5-10 hashtags.",
        "pinterest": "Descriptive, inspirational caption. 2-3 hashtags. Include a CTA.",
    }
    plat_hint = platform_instructions.get(platform.lower(), "Write an engaging caption with relevant hashtags.")

    prompt = f"""You are Emily, a brilliant social media manager for {biz_name}.
{f'About the brand: {biz_desc}' if biz_desc else ''}
Brand voice: {voice} | Industry: {industry} | Target audience: {audience}

Create a {platform} caption for a {media_type} named "{file_name}".{context_hint}

Platform guidance: {plat_hint}

Write ONLY the caption text — no labels, no JSON, no explanation."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.75,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"Caption generation failed for {file_name}: {e}")
        return f"✨ New {media_type} from {biz_name}! #{platform.lower().replace(' ', '')}"


def _queue_file(
    user_id: str,
    platform: str,
    caption: str,
    file: dict,
    auto_post: bool,
    scheduled_at: Optional[datetime],
    folder_name: str = "",
):
    """Insert (or skip if duplicate) a row into content_queue with schedule."""
    existing = supabase_admin.table("content_queue") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("drive_file_id", file["id"]) \
        .eq("platform", platform) \
        .execute()
    if existing.data:
        return

    supabase_admin.table("content_queue").insert({
        "user_id": user_id,
        "platform": platform,
        "caption": caption,
        "media_url": file.get("webContentLink") or file.get("webViewLink"),
        "file_name": file.get("name"),
        "drive_file_id": file["id"],
        "status": "scheduled" if auto_post else "draft",
        "auto_post": auto_post,
        "scheduled_at": scheduled_at.isoformat() if scheduled_at else None,
        "mime_type": file.get("mimeType", ""),
        "folder_source": folder_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).execute()


# ── Core scan logic ───────────────────────────────────────────────────────────

async def scan_drive_for_user(user_id: str) -> dict:
    """
    Core scan:
    1. Walk Emily folder
    2. Direct files → scheduled ASAP at next best slot
    3. Subfolders with date names → schedule files across staggered slots on that date
    4. Subfolders without date names (platform folders e.g. 'instagram') → immediate queuing per platform
    5. Generate rich captions via Emily (GPT-4o-mini) with business context
    """
    conn = _get_drive_connection(user_id)
    if not conn:
        return {"skipped": True, "reason": "no active google connection"}

    try:
        creds   = _refresh_credentials(conn, user_id)
        service = _build_drive_service(creds)

        emily_folder_id = _find_emily_folder(service)
        if not emily_folder_id:
            return {"found_files": 0, "queued": 0, "reason": "Emily folder not found"}

        platforms         = _get_connected_platforms(user_id) or ["facebook"]
        auto_post         = (conn.get("metadata") or {}).get("auto_post", False)
        business_context  = _get_business_context(user_id)
        queued_count      = 0
        total_found       = 0

        # ── 1. Direct files in Emily root ─────────────────────────────────────
        root_files = _list_files_in_folder(service, emily_folder_id)
        new_root_files = [f for f in root_files if not _is_processed(user_id, f["id"])]
        total_found += len(new_root_files)

        for platform in platforms:
            slots = _compute_schedule_slots(None, len(new_root_files), platform)
            for idx, f in enumerate(new_root_files):
                try:
                    caption = _generate_caption(f["name"], f.get("mimeType", ""), platform, business_context)
                    _queue_file(user_id, platform, caption, f, auto_post, slots[idx], folder_name="root")
                    queued_count += 1
                except Exception as fe:
                    logger.error(f"Error queuing root file {f['name']}: {fe}")

        for f in new_root_files:
            _mark_processed(user_id, f["id"], f["name"], f.get("mimeType", ""), "processed")

        # ── 2. Subfolders ──────────────────────────────────────────────────────
        subfolders = _list_subfolders(service, emily_folder_id)
        logger.info(f"Emily folder has {len(subfolders)} subfolder(s): {[s['name'] for s in subfolders]}")

        for subfolder in subfolders:
            folder_name = subfolder["name"]
            folder_id   = subfolder["id"]

            # Try to parse a date from the folder name
            target_dt = _parse_folder_date(folder_name)

            # Determine if this is a platform-specific folder (legacy)
            folder_lower = folder_name.lower().strip()
            is_platform_folder = folder_lower in {p.lower() for p in platforms} or folder_lower in {
                "instagram", "facebook", "twitter", "linkedin", "tiktok",
                "pinterest", "youtube", "wordpress", "whatsapp",
            }

            # Get files inside this subfolder
            all_files = _list_files_in_folder(service, folder_id)
            new_files = [f for f in all_files if not _is_processed(user_id, f["id"])]

            if not new_files:
                logger.info(f"Subfolder '{folder_name}': no new files, skipping")
                continue

            total_found += len(new_files)
            logger.info(
                f"Subfolder '{folder_name}': {len(new_files)} new file(s), "
                f"date_hint={target_dt}, platform_folder={is_platform_folder}"
            )

            if is_platform_folder:
                # Legacy: treat folder name AS the platform
                target_platform = folder_lower if folder_lower in {p.lower() for p in platforms} else folder_lower
                active_platforms_for_folder = [target_platform]
            else:
                active_platforms_for_folder = platforms

            for platform in active_platforms_for_folder:
                # Compute staggered slots for this platform
                slots = _compute_schedule_slots(target_dt, len(new_files), platform)

                for idx, f in enumerate(new_files):
                    try:
                        # Pass folder name as creative context hint to Emily
                        caption = _generate_caption(
                            f["name"], f.get("mimeType", ""), platform,
                            business_context, folder_context=folder_name
                        )
                        _queue_file(
                            user_id, platform, caption, f, auto_post,
                            scheduled_at=slots[idx],
                            folder_name=folder_name,
                        )
                        queued_count += 1
                        logger.info(
                            f"  ✅ Queued '{f['name']}' → {platform} at {slots[idx].strftime('%Y-%m-%d %H:%M UTC')}"
                        )
                    except Exception as fe:
                        logger.error(f"Error queuing '{f['name']}' in '{folder_name}': {fe}")
                        _mark_processed(user_id, f["id"], f["name"], f.get("mimeType", ""), "failed", str(fe))

            # Mark all files as processed (once, regardless of platform count)
            for f in new_files:
                _mark_processed(user_id, f["id"], f["name"], f.get("mimeType", ""), "processed")

        # Update last_scan_at
        meta = {**(conn.get("metadata") or {}), "last_scan_at": datetime.now(timezone.utc).isoformat()}
        if conn.get("_source") != "platform_connections":
            supabase_admin.table("user_connections").update({
                "metadata": meta,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", conn["id"]).execute()

        return {"found_files": total_found, "queued": queued_count}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Drive scan error for user {user_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"error": str(e)}


# ── API Endpoints ─────────────────────────────────────────────────────────────

class SaveDriveTokensRequest(BaseModel):
    access_token: str
    refresh_token: str
    token_expires_at: Optional[str] = None
    account_email: Optional[str] = None
    account_name: Optional[str] = None
    auto_post: Optional[bool] = False


class UpdateQueueItemRequest(BaseModel):
    status: Optional[str] = None
    auto_post: Optional[bool] = None
    caption: Optional[str] = None
    scheduled_at: Optional[str] = None


@router.post("/connect")
async def save_drive_connection(
    payload: SaveDriveTokensRequest,
    current_user: dict = Depends(_get_current_user),
):
    user_id = current_user["id"]
    try:
        upsert_data = {
            "user_id": user_id,
            "service": "google_drive",
            "access_token_encrypted": _encrypt(payload.access_token),
            "refresh_token_encrypted": _encrypt(payload.refresh_token) if payload.refresh_token else None,
            "token_expires_at": payload.token_expires_at,
            "account_email": payload.account_email,
            "account_name": payload.account_name,
            "is_active": True,
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {"auto_post": payload.auto_post or False},
        }
        supabase_admin.table("user_connections").upsert(upsert_data, on_conflict="user_id,service").execute()
        return {"success": True, "message": "Google Drive connected successfully"}
    except Exception as e:
        logger.error(f"Error saving drive connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_drive_status(current_user: dict = Depends(_get_current_user)):
    user_id = current_user["id"]
    conn = _get_drive_connection(user_id)

    if not conn:
        return {"connected": False, "emily_folder_found": False, "last_scan_at": None, "auto_post": False, "account_email": None}

    try:
        creds   = _refresh_credentials(conn, user_id)
        service = _build_drive_service(creds)
        emily_folder_id = _find_emily_folder(service)

        # Get subfolder names as extra info
        subfolder_names = []
        if emily_folder_id:
            subs = _list_subfolders(service, emily_folder_id)
            subfolder_names = [s["name"] for s in subs]

        meta = conn.get("metadata") or {}
        return {
            "connected": True,
            "emily_folder_found": emily_folder_id is not None,
            "last_scan_at": meta.get("last_scan_at"),
            "auto_post": meta.get("auto_post", False),
            "account_email": conn.get("account_email"),
            "account_name": conn.get("account_name"),
            "subfolders": subfolder_names,
        }
    except HTTPException as he:
        return {
            "connected": False, "emily_folder_found": False,
            "last_scan_at": None, "auto_post": False,
            "account_email": conn.get("account_email"),
            "token_expired": True, "error": he.detail,
        }
    except Exception as e:
        return {"connected": True, "error": str(e), "emily_folder_found": False, "auto_post": False}


@router.post("/scan")
async def manual_scan(current_user: dict = Depends(_get_current_user)):
    """Manually trigger a Drive scan for the current user."""
    user_id = current_user["id"]
    result  = await scan_drive_for_user(user_id)
    if result.get("skipped"):
        raise HTTPException(status_code=400, detail=result.get("reason", "Drive not connected"))
    return {"success": True, **result}


@router.get("/queue")
async def get_queue(
    status: Optional[str] = None,
    current_user: dict = Depends(_get_current_user),
):
    user_id = current_user["id"]
    query = supabase_admin.table("content_queue").select("*").eq("user_id", user_id)
    if status:
        query = query.eq("status", status)
    result = query.order("scheduled_at", desc=False).order("created_at", desc=True).execute()
    return {"items": result.data or []}


@router.patch("/queue/{item_id}")
async def update_queue_item(
    item_id: str,
    payload: UpdateQueueItemRequest,
    current_user: dict = Depends(_get_current_user),
):
    user_id = current_user["id"]
    update_data: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.status is not None:
        update_data["status"] = payload.status
    if payload.auto_post is not None:
        update_data["auto_post"] = payload.auto_post
    if payload.caption is not None:
        update_data["caption"] = payload.caption
    if payload.scheduled_at is not None:
        update_data["scheduled_at"] = payload.scheduled_at

    result = (
        supabase_admin.table("content_queue")
        .update(update_data)
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Queue item not found")
    return {"success": True, "item": result.data[0]}


@router.patch("/settings")
async def update_drive_settings(
    payload: dict,
    current_user: dict = Depends(_get_current_user),
):
    user_id = current_user["id"]
    conn = _get_drive_connection(user_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Google Drive not connected")

    meta = {**(conn.get("metadata") or {}), **payload}
    if conn.get("_source") != "platform_connections":
        supabase_admin.table("user_connections").update({
            "metadata": meta,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", conn["id"]).execute()
    return {"success": True, "metadata": meta}


@router.delete("/disconnect")
async def disconnect_drive(current_user: dict = Depends(_get_current_user)):
    user_id = current_user["id"]
    supabase_admin.table("user_connections") \
        .update({"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("user_id", user_id) \
        .eq("service", "google_drive") \
        .execute()
    return {"success": True, "message": "Google Drive disconnected"}


# ── Scheduler job ─────────────────────────────────────────────────────────────

async def scan_all_users_drive():
    """
    Background job: scan every user who has an active google connection.
    Runs every 5 minutes via APScheduler (registered in main.py).
    """
    try:
        # Scan users with dedicated drive connection
        result = (
            supabase_admin.table("user_connections")
            .select("user_id")
            .eq("service", "google_drive")
            .eq("is_active", True)
            .execute()
        )
        user_ids = {row["user_id"] for row in (result.data or [])}

        # Also scan users with google platform_connections (fallback)
        result2 = (
            supabase_admin.table("platform_connections")
            .select("user_id")
            .eq("platform", "google")
            .eq("is_active", True)
            .execute()
        )
        user_ids.update(row["user_id"] for row in (result2.data or []))

        logger.info(f"Drive monitor: scanning {len(user_ids)} user(s)")
        for uid in user_ids:
            try:
                res = await scan_drive_for_user(uid)
                if res.get("queued", 0):
                    logger.info(f"Drive monitor: queued {res['queued']} item(s) for user {uid}")
            except Exception as user_err:
                logger.error(f"Drive monitor error for user {uid}: {user_err}")
    except Exception as e:
        logger.error(f"Drive monitor scheduled job failed: {e}")
