"""
Reorganization service — EPIC M (box-reorganization-suggestions).

Provides:
  build_llm_prompt      — builds the Gemini prompt from warehouse items + boxes
  parse_llm_response    — parses and validates the LLM JSON response
  run_analysis          — executed by the background worker; drives the full analysis
  confirm_suggestion    — applies a suggested move and logs it to change_log
  dismiss_suggestion    — marks a suggestion as dismissed
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from collections.abc import Sequence
from urllib import error, request

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.llm import normalize_model_priority
from app.models.box import Box
from app.models.change_log import ChangeLog
from app.models.item import Item
from app.models.llm_setting import LLMSetting
from app.models.reorganization_session import ReorganizationSession
from app.services.secret_store import decrypt_secret
from app.services.sync_log import append_change_log

logger = logging.getLogger(__name__)

GEMINI_GENERATE_CONTENT_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

# ──────────────────────────────────────────────────────────────────────────────
# Prompt builder
# ──────────────────────────────────────────────────────────────────────────────

def build_llm_prompt(items: list[dict], boxes: list[dict]) -> str:
    """
    Build the Gemini prompt for reorganization analysis.

    items  — list of dicts with keys: id, name, tags, current_box_id, current_box_name
    boxes  — list of dicts with keys: id, name
    """
    items_text = "\n".join(
        f'- id={item["id"]} name="{item["name"]}" tags={item.get("tags", [])} '
        f'current_box_id={item["current_box_id"]} current_box_name="{item["current_box_name"]}"'
        for item in items
    )
    boxes_text = "\n".join(
        f'- id={box["id"]} name="{box["name"]}"'
        for box in boxes
    )

    return (
        "You are a warehouse organization assistant.\n"
        "Analyze the following inventory items and suggest which items should be moved to a different box "
        "to group items of the same type together and reduce clutter.\n\n"
        "Available boxes:\n"
        f"{boxes_text}\n\n"
        "Current items:\n"
        f"{items_text}\n\n"
        "Return ONLY a JSON object with this exact shape:\n"
        '{"suggestions": [{"item_id": "uuid", "to_box_id": "uuid", "reason": "short explanation"}]}\n\n'
        "Rules:\n"
        "- Only suggest moving items that genuinely benefit from being in a different box.\n"
        "- Do NOT suggest moving an item to its current box.\n"
        "- Only use box IDs from the provided list.\n"
        "- Keep reasons concise (max 120 characters).\n"
        "- If no moves are beneficial, return an empty suggestions array."
    )


# ──────────────────────────────────────────────────────────────────────────────
# Response parser
# ──────────────────────────────────────────────────────────────────────────────

def _extract_json_object(raw: str) -> dict:
    """Extract the first JSON object from a potentially text-wrapped response."""
    candidate = raw.strip()
    # Try direct parse first
    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Find first {...} block
    match = re.search(r"\{.*\}", candidate, flags=re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    raise ValueError("LLM response does not contain a valid JSON object")


def parse_llm_response(raw: str, warehouse_boxes: dict[str, str]) -> list[dict]:
    """
    Parse and validate the LLM JSON response.

    warehouse_boxes — mapping of box_id → box_name for the warehouse
    Returns a list of valid suggestion dicts (invalid/duplicate-position ones are silently discarded).
    """
    parsed = _extract_json_object(raw)
    raw_suggestions = parsed.get("suggestions")
    if not isinstance(raw_suggestions, list):
        logger.warning("LLM reorganization response missing 'suggestions' array")
        return []

    valid: list[dict] = []
    seen_suggestion_ids: set[str] = set()

    for entry in raw_suggestions:
        if not isinstance(entry, dict):
            continue

        item_id = str(entry.get("item_id") or "").strip()
        to_box_id = str(entry.get("to_box_id") or "").strip()
        reason = str(entry.get("reason") or "").strip()[:120]

        if not item_id or not to_box_id:
            continue

        # Discard suggestions referencing boxes not in this warehouse (Property 3)
        if to_box_id not in warehouse_boxes:
            logger.debug(
                "Discarding suggestion: to_box_id=%s not in warehouse boxes", to_box_id
            )
            continue

        suggestion_id = str(uuid.uuid4())
        # Guard against duplicate suggestion_ids (extremely unlikely but safe)
        while suggestion_id in seen_suggestion_ids:
            suggestion_id = str(uuid.uuid4())
        seen_suggestion_ids.add(suggestion_id)

        valid.append({
            "suggestion_id": suggestion_id,
            "item_id": item_id,
            "item_name": "",          # filled in by run_analysis after item lookup
            "from_box_id": "",        # filled in by run_analysis
            "from_box_name": "",      # filled in by run_analysis
            "to_box_id": to_box_id,
            "to_box_name": warehouse_boxes[to_box_id],
            "reason": reason,
            "status": "pending",
        })

    return valid


# ──────────────────────────────────────────────────────────────────────────────
# LLM call helper (mirrors pattern from llm_enrichment.py)
# ──────────────────────────────────────────────────────────────────────────────

def _call_gemini(
    *,
    api_key: str,
    model: str,
    prompt: str,
    timeout_seconds: float = 30.0,
) -> str:
    url = GEMINI_GENERATE_CONTENT_URL.format(model=model)
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json",
        },
    }
    req = request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )
    with request.urlopen(req, timeout=timeout_seconds) as res:  # noqa: S310
        payload = json.loads(res.read().decode("utf-8"))

    candidates = payload.get("candidates") or []
    if not candidates:
        raise ValueError("Gemini returned no candidates")
    parts = ((candidates[0].get("content") or {}).get("parts") or [])
    if not parts:
        raise ValueError("Gemini candidate has no parts")
    text = str(parts[0].get("text") or "").strip()
    if not text:
        raise ValueError("Gemini response text is empty")
    return text


def _runtime_model_candidates(configured_model: str) -> list[str]:
    """Return runtime alias candidates for a configured model ID."""
    base = configured_model.strip()
    return [base, f"{base}-preview", f"{base}-latest", f"{base}-preview-latest"]


def _call_gemini_with_fallback(
    *,
    api_key: str,
    model_priority: Sequence[str],
    prompt: str,
    operation_id: str,
) -> str:
    """
    Call Gemini with model_priority cascade + runtime alias fallback.
    Raises the last exception if all models fail.
    """
    last_exc: Exception = ValueError("No models configured")

    for configured_idx, configured_model in enumerate(model_priority, start=1):
        runtime_models = _runtime_model_candidates(configured_model)
        for runtime_idx, runtime_model in enumerate(runtime_models, start=1):
            logger.debug(
                "Reorganization LLM attempt op=%s configured=%s/%s model=%s runtime=%s/%s",
                operation_id,
                configured_idx,
                len(model_priority),
                configured_model,
                runtime_idx,
                len(runtime_models),
            )
            try:
                text = _call_gemini(api_key=api_key, model=runtime_model, prompt=prompt)
                logger.info(
                    "Reorganization LLM resolved op=%s winner=%s",
                    operation_id,
                    runtime_model,
                )
                return text
            except (error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
                last_exc = exc
                is_not_found = isinstance(exc, error.HTTPError) and exc.code == 404
                if is_not_found and runtime_idx < len(runtime_models):
                    logger.error(
                        "Reorganization LLM runtime 404 op=%s model=%s fallback=next_alias",
                        operation_id,
                        runtime_model,
                    )
                    continue
                logger.error(
                    "Reorganization LLM failed op=%s model=%s reason=%s",
                    operation_id,
                    runtime_model,
                    str(exc)[:200],
                )
                break  # try next configured model

    raise last_exc


# ──────────────────────────────────────────────────────────────────────────────
# run_analysis — called from the background worker
# ──────────────────────────────────────────────────────────────────────────────

def run_analysis(session_id: str, warehouse_id: str, db: Session) -> None:
    """
    Execute the reorganization analysis for a session.

    Loads items + boxes, calls Gemini, parses suggestions, and persists the result.
    Updates session.status to 'ready' on success or 'error' on failure.
    """
    operation_id = session_id[:8]
    logger.info(
        "Reorganization analysis started session_id=%s warehouse_id=%s",
        session_id,
        warehouse_id,
    )

    session = db.scalar(
        select(ReorganizationSession).where(ReorganizationSession.id == session_id)
    )
    if session is None:
        logger.error("Reorganization session not found session_id=%s", session_id)
        return

    try:
        # ── 1. Load LLM settings ──────────────────────────────────────────────
        llm_setting = db.scalar(
            select(LLMSetting).where(LLMSetting.warehouse_id == warehouse_id)
        )
        if llm_setting is None or not llm_setting.api_key_encrypted:
            session.status = "error"
            session.error_message = "LLM no configurado para este warehouse. Configura una API key de Gemini en Ajustes."
            db.commit()
            logger.error(
                "Reorganization aborted: no LLM config session_id=%s warehouse_id=%s",
                session_id,
                warehouse_id,
            )
            return

        try:
            api_key = decrypt_secret(llm_setting.api_key_encrypted)
        except Exception as exc:  # noqa: BLE001
            session.status = "error"
            session.error_message = "No se pudo descifrar la API key de Gemini."
            db.commit()
            logger.error(
                "Reorganization aborted: decrypt failed session_id=%s reason=%s",
                session_id,
                exc,
            )
            return

        model_priority = normalize_model_priority(llm_setting.model_priority)

        # ── 2. Load active items (deleted_at IS NULL) ─────────────────────────
        items_rows = db.scalars(
            select(Item).where(
                Item.warehouse_id == warehouse_id,
                Item.deleted_at.is_(None),
            )
        ).all()

        if not items_rows:
            # No items → return empty suggestions (not an error)
            session.status = "ready"
            session.suggestions = []
            session.error_message = None
            db.commit()
            logger.info(
                "Reorganization completed with 0 items session_id=%s", session_id
            )
            return

        # ── 3. Load active boxes ──────────────────────────────────────────────
        boxes_rows = db.scalars(
            select(Box).where(
                Box.warehouse_id == warehouse_id,
                Box.deleted_at.is_(None),
            )
        ).all()

        # Build lookup maps
        box_map: dict[str, str] = {box.id: box.name for box in boxes_rows}
        item_map: dict[str, Item] = {item.id: item for item in items_rows}

        items_payload = [
            {
                "id": item.id,
                "name": item.name,
                "tags": item.tags or [],
                "current_box_id": item.box_id,
                "current_box_name": box_map.get(item.box_id, ""),
            }
            for item in items_rows
        ]
        boxes_payload = [{"id": box_id, "name": name} for box_id, name in box_map.items()]

        # ── 4. Build prompt and call LLM ──────────────────────────────────────
        prompt = build_llm_prompt(items_payload, boxes_payload)
        logger.debug(
            "Reorganization prompt built session_id=%s items=%s boxes=%s",
            session_id,
            len(items_payload),
            len(boxes_payload),
        )

        raw_response = _call_gemini_with_fallback(
            api_key=api_key,
            model_priority=model_priority,
            prompt=prompt,
            operation_id=operation_id,
        )

        # ── 5. Parse and enrich suggestions ───────────────────────────────────
        suggestions = parse_llm_response(raw_response, box_map)

        # Enrich with item metadata and discard suggestions for unknown/deleted items
        # Also discard where from_box_id == to_box_id (no-op moves)
        enriched: list[dict] = []
        for suggestion in suggestions:
            item = item_map.get(suggestion["item_id"])
            if item is None:
                logger.debug(
                    "Discarding suggestion: item_id=%s not found in warehouse",
                    suggestion["item_id"],
                )
                continue
            if item.box_id == suggestion["to_box_id"]:
                logger.debug(
                    "Discarding suggestion: item already in target box item_id=%s box_id=%s",
                    item.id,
                    item.box_id,
                )
                continue
            suggestion["item_name"] = item.name
            suggestion["from_box_id"] = item.box_id
            suggestion["from_box_name"] = box_map.get(item.box_id, "")
            enriched.append(suggestion)

        # ── 6. Persist result ─────────────────────────────────────────────────
        session.suggestions = enriched
        session.status = "ready"
        session.error_message = None
        db.commit()

        logger.info(
            "Reorganization analysis completed session_id=%s suggestions=%s",
            session_id,
            len(enriched),
        )

    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Reorganization analysis failed session_id=%s reason=%s",
            session_id,
            str(exc)[:400],
        )
        try:
            session.status = "error"
            session.error_message = str(exc)[:1000]
            db.commit()
        except Exception:  # noqa: BLE001
            logger.exception("Failed to persist error state for session_id=%s", session_id)


# ──────────────────────────────────────────────────────────────────────────────
# confirm_suggestion
# ──────────────────────────────────────────────────────────────────────────────

def confirm_suggestion(
    session: ReorganizationSession,
    suggestion_id: str,
    db: Session,
    user_id: str,
) -> ReorganizationSession:
    """
    Confirm a suggestion: move the item to the target box and log the change.

    Raises:
        KeyError  — suggestion_id not found in session
        LookupError — item not found or deleted
    """
    suggestions: list[dict] = list(session.suggestions or [])
    target_idx = next(
        (i for i, s in enumerate(suggestions) if s.get("suggestion_id") == suggestion_id),
        None,
    )
    if target_idx is None:
        raise KeyError(f"Suggestion {suggestion_id!r} not found in session {session.id!r}")

    suggestion = suggestions[target_idx]

    # Load item — must exist and not be deleted
    item = db.scalar(
        select(Item).where(
            Item.id == suggestion["item_id"],
            Item.warehouse_id == session.warehouse_id,
        )
    )
    if item is None or item.deleted_at is not None:
        raise LookupError(f"Item {suggestion['item_id']!r} not found or deleted")

    to_box_id: str = suggestion["to_box_id"]

    if item.box_id != to_box_id:
        # Apply the move
        from_box_id = item.box_id
        item.box_id = to_box_id
        item.version = (item.version or 1) + 1

        append_change_log(
            db,
            warehouse_id=session.warehouse_id,
            entity_type="item",
            entity_id=item.id,
            action="move",
            entity_version=item.version,
            payload={
                "from_box_id": from_box_id,
                "to_box_id": to_box_id,
                "suggestion_id": suggestion_id,
                "session_id": session.id,
                "user_id": user_id,
            },
        )

    # Mark suggestion confirmed (idempotent — works even if already in target box)
    suggestions[target_idx] = {**suggestion, "status": "confirmed"}
    session.suggestions = suggestions

    _maybe_complete_session(session)
    db.commit()
    return session


# ──────────────────────────────────────────────────────────────────────────────
# dismiss_suggestion
# ──────────────────────────────────────────────────────────────────────────────

def dismiss_suggestion(
    session: ReorganizationSession,
    suggestion_id: str,
    db: Session,
) -> ReorganizationSession:
    """
    Dismiss a suggestion without moving the item.

    Raises:
        KeyError — suggestion_id not found in session
    """
    suggestions: list[dict] = list(session.suggestions or [])
    target_idx = next(
        (i for i, s in enumerate(suggestions) if s.get("suggestion_id") == suggestion_id),
        None,
    )
    if target_idx is None:
        raise KeyError(f"Suggestion {suggestion_id!r} not found in session {session.id!r}")

    suggestion = suggestions[target_idx]
    suggestions[target_idx] = {**suggestion, "status": "dismissed"}
    session.suggestions = suggestions

    _maybe_complete_session(session)
    db.commit()
    return session


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _maybe_complete_session(session: ReorganizationSession) -> None:
    """Transition session to 'completed' when all suggestions are resolved."""
    suggestions = session.suggestions or []
    if not suggestions:
        return
    all_resolved = all(
        s.get("status") in ("confirmed", "dismissed") for s in suggestions
    )
    if all_resolved:
        session.status = "completed"
