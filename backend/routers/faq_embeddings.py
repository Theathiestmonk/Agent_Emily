from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, HTTPException, Header, status
from supabase import Client, create_client

from services.embedding_service import EmbeddingService

router = APIRouter()
logger = logging.getLogger(__name__)


@lru_cache()
def _get_supabase_client() -> Client:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set")
    return create_client(supabase_url, supabase_key)


@lru_cache()
def _get_embedding_service() -> EmbeddingService:
    return EmbeddingService()


@router.post("/faq-embeddings/update")
def update_faq_embedding(payload: dict[str, Any], authorization: str | None = Header(None)):
    faq_id = payload.get("id")
    response_text = payload.get("response")

    if not faq_id or not response_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both `id` and `response` fields are required",
        )

    expected_key = os.getenv("FAQ_EMBED_KEY")
    if expected_key and authorization != f"Bearer {expected_key}":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    embedding_service = _get_embedding_service()
    vector = embedding_service.generate_embedding_from_text(response_text)

    supabase = _get_supabase_client()
    update_data = {
        "embedding_faq": vector,
        "embedding_needs_update": False,
        "embedding_updated_at": "now()",
    }

    response = (
        supabase.table("faq_responses")
        .update(update_data)
        .eq("id", faq_id)
        .execute()
    )

    if not response.data:
        logger.error("Failed to update embedding for FAQ %s: %s", faq_id, response)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update FAQ embedding",
        )

    logger.info("Updated embedding for FAQ %s", faq_id)
    return {"success": True, "id": faq_id}

