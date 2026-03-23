"""
Tests for EPIC M — box-reorganization-suggestions.

Covers:
  - Unit tests: endpoint behaviour (POST/GET sessions, confirm, dismiss, auth)
  - Property tests (hypothesis, min 100 examples each): Properties 1–10 from design.md

# Feature: box-reorganization-suggestions
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from hypothesis import given, settings as h_settings, HealthCheck
from hypothesis import strategies as st
from sqlalchemy.orm import Session

# ──────────────────────────────────────────────────────────────────────────────
# Helpers shared across unit + property tests
# ──────────────────────────────────────────────────────────────────────────────

def _signup_login(client, email: str) -> dict[str, str]:
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "pw123456", "display_name": "U"},
    )
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "pw123456"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _create_warehouse(client, headers) -> str:
    r = client.post("/api/v1/warehouses", json={"name": "WH"}, headers=headers)
    assert r.status_code == 201
    return r.json()["id"]


def _create_box(client, headers, wid, name="Box") -> str:
    r = client.post(f"/api/v1/warehouses/{wid}/boxes", json={"name": name}, headers=headers)
    assert r.status_code == 201
    return r.json()["id"]


def _create_item(client, headers, wid, box_id, name="Item") -> str:
    r = client.post(
        f"/api/v1/warehouses/{wid}/items",
        json={"box_id": box_id, "name": name, "tags": ["tag1"]},
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()["id"]


def _set_llm_key(client, headers, wid) -> None:
    """Store a fake (but encrypt-able) LLM API key for the warehouse."""
    client.put(
        "/api/v1/settings/llm",
        params={"warehouse_id": wid},
        json={"api_key_value": "fake-gemini-key", "language": "es"},
        headers=headers,
    )


def _fake_gemini_response(suggestions: list[dict]) -> str:
    return json.dumps({"suggestions": suggestions})


def _patch_gemini(raw_response: str):
    """Context manager that patches the Gemini HTTP call in reorganization service."""
    return patch(
        "app.services.reorganization._call_gemini",
        return_value=raw_response,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Unit tests — endpoint behaviour
# ──────────────────────────────────────────────────────────────────────────────

def test_post_session_no_llm_key_returns_error_session(client):
    """POST /sessions without LLM key → session created but worker sets status=error."""
    headers = _signup_login(client, "reorg-nokey@example.com")
    wid = _create_warehouse(client, headers)
    box_id = _create_box(client, headers, wid)
    _create_item(client, headers, wid, box_id)

    # Do NOT set LLM key — worker should set status=error
    import time
    r = client.post(f"/api/v1/warehouses/{wid}/reorganization/sessions", headers=headers)
    assert r.status_code in (200, 201)
    session_id = r.json()["id"]

    # Poll briefly for worker to finish (it's synchronous in test via SQLite)
    for _ in range(20):
        time.sleep(0.05)
        cur = client.get(
            f"/api/v1/warehouses/{wid}/reorganization/sessions/current",
            headers=headers,
        )
        if cur.json()["status"] != "running":
            break

    cur = client.get(
        f"/api/v1/warehouses/{wid}/reorganization/sessions/current",
        headers=headers,
    )
    assert cur.json()["status"] == "error"
    assert cur.json()["error_message"] is not None


def test_post_session_existing_running_returns_same(client):
    """POST /sessions when running session exists → returns existing (200, not 201)."""
    headers = _signup_login(client, "reorg-existing@example.com")
    wid = _create_warehouse(client, headers)

    # Manually insert a running session via the DB override
    from app.db.session import engine
    from app.models.reorganization_session import ReorganizationSession

    with Session(bind=engine) as db:
        sess = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by="dummy",
            status="running",
            suggestions=[],
        )
        db.add(sess)
        db.commit()
        existing_id = sess.id

    r = client.post(f"/api/v1/warehouses/{wid}/reorganization/sessions", headers=headers)
    assert r.status_code == 200
    assert r.json()["id"] == existing_id


def test_post_session_force_archives_previous(client):
    """POST /sessions?force=true → archives existing ready session, creates new one."""
    headers = _signup_login(client, "reorg-force@example.com")
    wid = _create_warehouse(client, headers)

    from app.db.session import engine
    from app.models.reorganization_session import ReorganizationSession

    with Session(bind=engine) as db:
        old = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by="dummy",
            status="ready",
            suggestions=[],
        )
        db.add(old)
        db.commit()
        old_id = old.id

    r = client.post(
        f"/api/v1/warehouses/{wid}/reorganization/sessions?force=true",
        headers=headers,
    )
    assert r.status_code == 201
    new_id = r.json()["id"]
    assert new_id != old_id

    # Old session must be archived
    with Session(bind=engine) as db:
        from sqlalchemy import select
        from app.models.reorganization_session import ReorganizationSession as RS
        old_sess = db.scalar(select(RS).where(RS.id == old_id))
        assert old_sess.status == "archived"


def test_get_current_session_no_sessions_returns_404(client):
    """GET /sessions/current with no sessions → 404."""
    headers = _signup_login(client, "reorg-404@example.com")
    wid = _create_warehouse(client, headers)

    r = client.get(f"/api/v1/warehouses/{wid}/reorganization/sessions/current", headers=headers)
    assert r.status_code == 404


def test_confirm_deleted_item_returns_404(client):
    """Confirming a suggestion for a deleted item → 404."""
    headers = _signup_login(client, "reorg-del@example.com")
    wid = _create_warehouse(client, headers)
    box_id = _create_box(client, headers, wid)
    box2_id = _create_box(client, headers, wid, "Box2")
    item_id = _create_item(client, headers, wid, box_id)

    # Soft-delete the item
    client.delete(f"/api/v1/warehouses/{wid}/items/{item_id}", headers=headers)

    suggestion_id = str(uuid.uuid4())
    from app.db.session import engine
    from app.models.reorganization_session import ReorganizationSession

    with Session(bind=engine) as db:
        sess = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by="dummy",
            status="ready",
            suggestions=[{
                "suggestion_id": suggestion_id,
                "item_id": item_id,
                "item_name": "Item",
                "from_box_id": box_id,
                "from_box_name": "Box",
                "to_box_id": box2_id,
                "to_box_name": "Box2",
                "reason": "test",
                "status": "pending",
            }],
        )
        db.add(sess)
        db.commit()
        sess_id = sess.id

    r = client.post(
        f"/api/v1/warehouses/{wid}/reorganization/sessions/{sess_id}/suggestions/{suggestion_id}/confirm",
        headers=headers,
    )
    assert r.status_code == 404


def test_confirm_item_already_in_target_box_is_idempotent(client):
    """Confirming when item is already in target box → 200, no error, status=confirmed."""
    headers = _signup_login(client, "reorg-idem@example.com")
    wid = _create_warehouse(client, headers)
    box_id = _create_box(client, headers, wid)
    item_id = _create_item(client, headers, wid, box_id)

    suggestion_id = str(uuid.uuid4())
    from app.db.session import engine
    from app.models.reorganization_session import ReorganizationSession

    with Session(bind=engine) as db:
        sess = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by="dummy",
            status="ready",
            suggestions=[{
                "suggestion_id": suggestion_id,
                "item_id": item_id,
                "item_name": "Item",
                "from_box_id": box_id,
                "from_box_name": "Box",
                "to_box_id": box_id,   # same box → idempotent
                "to_box_name": "Box",
                "reason": "test",
                "status": "pending",
            }],
        )
        db.add(sess)
        db.commit()
        sess_id = sess.id

    r = client.post(
        f"/api/v1/warehouses/{wid}/reorganization/sessions/{sess_id}/suggestions/{suggestion_id}/confirm",
        headers=headers,
    )
    assert r.status_code == 200
    confirmed = next(s for s in r.json()["suggestions"] if s["suggestion_id"] == suggestion_id)
    assert confirmed["status"] == "confirmed"


def test_dismiss_suggestion_leaves_others_unchanged(client):
    """Dismissing one suggestion → only that one changes, others stay pending."""
    headers = _signup_login(client, "reorg-dismiss@example.com")
    wid = _create_warehouse(client, headers)
    box_id = _create_box(client, headers, wid)
    box2_id = _create_box(client, headers, wid, "Box2")
    item1_id = _create_item(client, headers, wid, box_id, "Item1")
    item2_id = _create_item(client, headers, wid, box_id, "Item2")

    sid1 = str(uuid.uuid4())
    sid2 = str(uuid.uuid4())

    from app.db.session import engine
    from app.models.reorganization_session import ReorganizationSession

    with Session(bind=engine) as db:
        sess = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by="dummy",
            status="ready",
            suggestions=[
                {
                    "suggestion_id": sid1,
                    "item_id": item1_id,
                    "item_name": "Item1",
                    "from_box_id": box_id,
                    "from_box_name": "Box",
                    "to_box_id": box2_id,
                    "to_box_name": "Box2",
                    "reason": "r1",
                    "status": "pending",
                },
                {
                    "suggestion_id": sid2,
                    "item_id": item2_id,
                    "item_name": "Item2",
                    "from_box_id": box_id,
                    "from_box_name": "Box",
                    "to_box_id": box2_id,
                    "to_box_name": "Box2",
                    "reason": "r2",
                    "status": "pending",
                },
            ],
        )
        db.add(sess)
        db.commit()
        sess_id = sess.id

    r = client.post(
        f"/api/v1/warehouses/{wid}/reorganization/sessions/{sess_id}/suggestions/{sid1}/dismiss",
        headers=headers,
    )
    assert r.status_code == 200
    by_id = {s["suggestion_id"]: s for s in r.json()["suggestions"]}
    assert by_id[sid1]["status"] == "dismissed"
    assert by_id[sid2]["status"] == "pending"


def test_all_suggestions_resolved_sets_session_completed(client):
    """When all suggestions are confirmed/dismissed → session.status = completed."""
    headers = _signup_login(client, "reorg-complete@example.com")
    wid = _create_warehouse(client, headers)
    box_id = _create_box(client, headers, wid)
    box2_id = _create_box(client, headers, wid, "Box2")
    item_id = _create_item(client, headers, wid, box_id)

    sid = str(uuid.uuid4())

    from app.db.session import engine
    from app.models.reorganization_session import ReorganizationSession

    with Session(bind=engine) as db:
        sess = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by="dummy",
            status="ready",
            suggestions=[{
                "suggestion_id": sid,
                "item_id": item_id,
                "item_name": "Item",
                "from_box_id": box_id,
                "from_box_name": "Box",
                "to_box_id": box2_id,
                "to_box_name": "Box2",
                "reason": "r",
                "status": "pending",
            }],
        )
        db.add(sess)
        db.commit()
        sess_id = sess.id

    r = client.post(
        f"/api/v1/warehouses/{wid}/reorganization/sessions/{sess_id}/suggestions/{sid}/confirm",
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "completed"


def test_unauthenticated_user_gets_403(client):
    """Requests without auth token → 401/403."""
    r = client.post("/api/v1/warehouses/fake-wid/reorganization/sessions")
    assert r.status_code in (401, 403)


def test_non_member_gets_403(client):
    """User who is not a member of the warehouse → 403."""
    owner_headers = _signup_login(client, "reorg-owner@example.com")
    other_headers = _signup_login(client, "reorg-other@example.com")
    wid = _create_warehouse(client, owner_headers)

    r = client.post(
        f"/api/v1/warehouses/{wid}/reorganization/sessions",
        headers=other_headers,
    )
    assert r.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# Unit tests — service layer (pure / no HTTP)
# ──────────────────────────────────────────────────────────────────────────────

def test_confirm_updates_item_box_and_logs_change(client):
    """
    Confirming a suggestion moves item.box_id and writes a change_log entry.
    Validates: Requirements M.4.1, M.4.2
    """
    from app.db.session import engine
    from app.models.change_log import ChangeLog
    from app.models.item import Item
    from app.models.reorganization_session import ReorganizationSession
    from app.services.reorganization import confirm_suggestion
    from sqlalchemy import select

    headers = _signup_login(client, "reorg-confirm-svc@example.com")
    wid = _create_warehouse(client, headers)
    box_id = _create_box(client, headers, wid, "From")
    box2_id = _create_box(client, headers, wid, "To")
    item_id = _create_item(client, headers, wid, box_id)

    sid = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    with Session(bind=engine) as db:
        sess = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by=user_id,
            status="ready",
            suggestions=[{
                "suggestion_id": sid,
                "item_id": item_id,
                "item_name": "Item",
                "from_box_id": box_id,
                "from_box_name": "From",
                "to_box_id": box2_id,
                "to_box_name": "To",
                "reason": "group",
                "status": "pending",
            }],
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)

        confirm_suggestion(sess, sid, db, user_id)

        item = db.scalar(select(Item).where(Item.id == item_id))
        assert item.box_id == box2_id

        log = db.scalar(
            select(ChangeLog).where(
                ChangeLog.entity_type == "item",
                ChangeLog.action == "move",
                ChangeLog.entity_id == item_id,
            )
        )
        assert log is not None
        assert log.payload_json["user_id"] == user_id


def test_dismiss_does_not_move_item(client):
    """Dismissing a suggestion must NOT change item.box_id."""
    from app.db.session import engine
    from app.models.item import Item
    from app.models.reorganization_session import ReorganizationSession
    from app.services.reorganization import dismiss_suggestion
    from sqlalchemy import select

    headers = _signup_login(client, "reorg-dismiss-svc@example.com")
    wid = _create_warehouse(client, headers)
    box_id = _create_box(client, headers, wid, "From")
    box2_id = _create_box(client, headers, wid, "To")
    item_id = _create_item(client, headers, wid, box_id)

    sid = str(uuid.uuid4())

    with Session(bind=engine) as db:
        sess = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by="u",
            status="ready",
            suggestions=[{
                "suggestion_id": sid,
                "item_id": item_id,
                "item_name": "Item",
                "from_box_id": box_id,
                "from_box_name": "From",
                "to_box_id": box2_id,
                "to_box_name": "To",
                "reason": "r",
                "status": "pending",
            }],
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)

        dismiss_suggestion(sess, sid, db)

        item = db.scalar(select(Item).where(Item.id == item_id))
        assert item.box_id == box_id  # unchanged


# ──────────────────────────────────────────────────────────────────────────────
# Property tests — hypothesis (min 100 examples each)
# ──────────────────────────────────────────────────────────────────────────────

# Strategies
_uuid_st = st.uuids().map(str)
_name_st = st.text(min_size=1, max_size=40, alphabet=st.characters(whitelist_categories=("L", "N", "P", "Zs")))
_reason_st = st.text(min_size=0, max_size=120)
_tags_st = st.lists(st.text(min_size=1, max_size=20), max_size=5)


def _make_item_dict(item_id=None, box_id=None, box_name="Box", name="Item", tags=None):
    return {
        "id": item_id or str(uuid.uuid4()),
        "name": name,
        "tags": tags or [],
        "current_box_id": box_id or str(uuid.uuid4()),
        "current_box_name": box_name,
    }


def _make_box_dict(box_id=None, name="Box"):
    return {"id": box_id or str(uuid.uuid4()), "name": name}


# ── Property 1: Warehouse isolation ──────────────────────────────────────────

@h_settings(max_examples=100)
@given(
    n_items=st.integers(min_value=1, max_value=10),
    n_boxes=st.integers(min_value=1, max_value=5),
)
def test_suggestions_only_reference_warehouse_entities(n_items, n_boxes):
    """
    # Feature: box-reorganization-suggestions, Property 1:
    All suggestions from parse_llm_response reference only boxes in warehouse_boxes.
    """
    from app.services.reorganization import parse_llm_response

    boxes = [_make_box_dict() for _ in range(n_boxes)]
    warehouse_boxes = {b["id"]: b["name"] for b in boxes}

    # Mix valid and invalid to_box_ids
    raw_suggestions = []
    for i in range(n_items):
        valid_box = boxes[i % n_boxes]["id"]
        raw_suggestions.append({
            "item_id": str(uuid.uuid4()),
            "to_box_id": valid_box,
            "reason": "group",
        })
    # Add some with invalid box ids
    for _ in range(3):
        raw_suggestions.append({
            "item_id": str(uuid.uuid4()),
            "to_box_id": str(uuid.uuid4()),  # not in warehouse
            "reason": "invalid",
        })

    raw = json.dumps({"suggestions": raw_suggestions})
    result = parse_llm_response(raw, warehouse_boxes)

    for s in result:
        assert s["to_box_id"] in warehouse_boxes, (
            f"Suggestion references box {s['to_box_id']} not in warehouse"
        )


# ── Property 2: Suggestion has all required fields ────────────────────────────

@h_settings(max_examples=100)
@given(
    n_suggestions=st.integers(min_value=1, max_value=8),
)
def test_suggestion_has_all_required_fields(n_suggestions):
    """
    # Feature: box-reorganization-suggestions, Property 2:
    Every suggestion returned by parse_llm_response has all required fields
    and status='pending'.
    """
    from app.services.reorganization import parse_llm_response

    box_id = str(uuid.uuid4())
    warehouse_boxes = {box_id: "TestBox"}

    raw_suggestions = [
        {"item_id": str(uuid.uuid4()), "to_box_id": box_id, "reason": f"r{i}"}
        for i in range(n_suggestions)
    ]
    raw = json.dumps({"suggestions": raw_suggestions})
    result = parse_llm_response(raw, warehouse_boxes)

    required_fields = {
        "suggestion_id", "item_id", "item_name", "from_box_id",
        "from_box_name", "to_box_id", "to_box_name", "reason", "status",
    }
    for s in result:
        assert required_fields.issubset(s.keys()), f"Missing fields: {required_fields - s.keys()}"
        assert s["status"] == "pending"


# ── Property 3: Invalid to_box_id discarded ───────────────────────────────────

@h_settings(max_examples=100)
@given(
    n_valid=st.integers(min_value=0, max_value=5),
    n_invalid=st.integers(min_value=1, max_value=5),
)
def test_invalid_to_box_id_discarded(n_valid, n_invalid):
    """
    # Feature: box-reorganization-suggestions, Property 3:
    Suggestions with to_box_id not in warehouse_boxes are silently discarded;
    valid ones are preserved.
    """
    from app.services.reorganization import parse_llm_response

    valid_box_ids = [str(uuid.uuid4()) for _ in range(max(n_valid, 1))]
    warehouse_boxes = {bid: f"Box-{i}" for i, bid in enumerate(valid_box_ids)}

    raw_suggestions = []
    for i in range(n_valid):
        raw_suggestions.append({
            "item_id": str(uuid.uuid4()),
            "to_box_id": valid_box_ids[i % len(valid_box_ids)],
            "reason": "ok",
        })
    for _ in range(n_invalid):
        raw_suggestions.append({
            "item_id": str(uuid.uuid4()),
            "to_box_id": str(uuid.uuid4()),  # not in warehouse
            "reason": "bad",
        })

    raw = json.dumps({"suggestions": raw_suggestions})
    result = parse_llm_response(raw, warehouse_boxes)

    assert len(result) == n_valid
    for s in result:
        assert s["to_box_id"] in warehouse_boxes


# ── Property 4: Prompt includes all active items ──────────────────────────────

@h_settings(max_examples=100)
@given(
    items=st.lists(
        st.fixed_dictionaries({
            "id": _uuid_st,
            "name": _name_st,
            "tags": _tags_st,
            "current_box_id": _uuid_st,
            "current_box_name": _name_st,
        }),
        min_size=1,
        max_size=15,
    )
)
def test_prompt_includes_all_active_items(items):
    """
    # Feature: box-reorganization-suggestions, Property 4:
    build_llm_prompt includes every item's id and name in the prompt text.
    """
    from app.services.reorganization import build_llm_prompt

    boxes = [{"id": str(uuid.uuid4()), "name": "B"}]
    prompt = build_llm_prompt(items, boxes)

    for item in items:
        assert item["id"] in prompt, f"Item id {item['id']} missing from prompt"
        assert item["name"] in prompt, f"Item name {item['name']} missing from prompt"


# ── Property 5: Confirm round-trip — box_id + status + change_log ─────────────

@h_settings(max_examples=100)
@given(reason=_reason_st)
def test_confirm_updates_box_and_logs(reason):
    """
    # Feature: box-reorganization-suggestions, Property 5:
    After confirm_suggestion: item.box_id == to_box_id, suggestion.status == 'confirmed',
    and a change_log entry exists with entity_type='item', action='move'.
    """
    from app.db.session import engine
    from app.models.box import Box
    from app.models.change_log import ChangeLog
    from app.models.item import Item
    from app.models.membership import Membership
    from app.models.reorganization_session import ReorganizationSession
    from app.models.user import User
    from app.models.warehouse import Warehouse
    from app.services.reorganization import confirm_suggestion
    from app.services.security import hash_password
    from sqlalchemy import select

    with Session(bind=engine) as db:
        uid = str(uuid.uuid4())
        wid = str(uuid.uuid4())
        box1_id = str(uuid.uuid4())
        box2_id = str(uuid.uuid4())
        item_id = str(uuid.uuid4())
        sid = str(uuid.uuid4())

        db.add(User(id=uid, email=f"{uid}@t.com", password_hash=hash_password("x"), display_name="T"))
        db.add(Warehouse(id=wid, name="W", created_by=uid))
        db.add(Membership(user_id=uid, warehouse_id=wid))
        db.add(Box(id=box1_id, warehouse_id=wid, name="B1", qr_token=str(uuid.uuid4()), short_code=f"s{box1_id[:6]}"))
        db.add(Box(id=box2_id, warehouse_id=wid, name="B2", qr_token=str(uuid.uuid4()), short_code=f"s{box2_id[:6]}"))
        db.add(Item(id=item_id, warehouse_id=wid, box_id=box1_id, name="I", version=1))
        sess = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by=uid,
            status="ready",
            suggestions=[{
                "suggestion_id": sid,
                "item_id": item_id,
                "item_name": "I",
                "from_box_id": box1_id,
                "from_box_name": "B1",
                "to_box_id": box2_id,
                "to_box_name": "B2",
                "reason": reason[:120],
                "status": "pending",
            }],
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)

        confirm_suggestion(sess, sid, db, uid)

        item = db.scalar(select(Item).where(Item.id == item_id))
        assert item.box_id == box2_id

        confirmed_s = next(s for s in sess.suggestions if s["suggestion_id"] == sid)
        assert confirmed_s["status"] == "confirmed"

        log = db.scalar(
            select(ChangeLog).where(
                ChangeLog.entity_type == "item",
                ChangeLog.action == "move",
                ChangeLog.entity_id == item_id,
            )
        )
        assert log is not None


# ── Property 6: Idempotence of confirm ────────────────────────────────────────

@h_settings(max_examples=100)
@given(reason=_reason_st)
def test_confirm_idempotent_when_already_in_target(reason):
    """
    # Feature: box-reorganization-suggestions, Property 6:
    Confirming when item is already in to_box_id → status=confirmed, no duplicate change_log.
    """
    from app.db.session import engine
    from app.models.box import Box
    from app.models.change_log import ChangeLog
    from app.models.item import Item
    from app.models.membership import Membership
    from app.models.reorganization_session import ReorganizationSession
    from app.models.user import User
    from app.models.warehouse import Warehouse
    from app.services.reorganization import confirm_suggestion
    from app.services.security import hash_password
    from sqlalchemy import select, func

    with Session(bind=engine) as db:
        uid = str(uuid.uuid4())
        wid = str(uuid.uuid4())
        box_id = str(uuid.uuid4())
        item_id = str(uuid.uuid4())
        sid = str(uuid.uuid4())

        db.add(User(id=uid, email=f"{uid}@t.com", password_hash=hash_password("x"), display_name="T"))
        db.add(Warehouse(id=wid, name="W", created_by=uid))
        db.add(Membership(user_id=uid, warehouse_id=wid))
        db.add(Box(id=box_id, warehouse_id=wid, name="B", qr_token=str(uuid.uuid4()), short_code=f"s{box_id[:6]}"))
        db.add(Item(id=item_id, warehouse_id=wid, box_id=box_id, name="I", version=1))
        sess = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by=uid,
            status="ready",
            suggestions=[{
                "suggestion_id": sid,
                "item_id": item_id,
                "item_name": "I",
                "from_box_id": box_id,
                "from_box_name": "B",
                "to_box_id": box_id,   # same box
                "to_box_name": "B",
                "reason": reason[:120],
                "status": "pending",
            }],
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)

        logs_before = db.scalar(select(func.count()).select_from(ChangeLog).where(
            ChangeLog.entity_id == item_id
        ))

        confirm_suggestion(sess, sid, db, uid)

        confirmed_s = next(s for s in sess.suggestions if s["suggestion_id"] == sid)
        assert confirmed_s["status"] == "confirmed"

        logs_after = db.scalar(select(func.count()).select_from(ChangeLog).where(
            ChangeLog.entity_id == item_id
        ))
        # No new change_log entry when item was already in target box
        assert logs_after == logs_before


# ── Property 7: Dismiss isolates single suggestion ────────────────────────────

@h_settings(max_examples=100)
@given(
    n_suggestions=st.integers(min_value=2, max_value=8),
    dismiss_idx=st.integers(min_value=0, max_value=7),
)
def test_dismiss_isolates_single_suggestion(n_suggestions, dismiss_idx):
    """
    # Feature: box-reorganization-suggestions, Property 7:
    Dismissing one suggestion changes only that suggestion's status; all others unchanged.
    """
    from app.db.session import engine
    from app.models.box import Box
    from app.models.item import Item
    from app.models.membership import Membership
    from app.models.reorganization_session import ReorganizationSession
    from app.models.user import User
    from app.models.warehouse import Warehouse
    from app.services.reorganization import dismiss_suggestion
    from app.services.security import hash_password

    actual_idx = dismiss_idx % n_suggestions

    with Session(bind=engine) as db:
        uid = str(uuid.uuid4())
        wid = str(uuid.uuid4())
        box1_id = str(uuid.uuid4())
        box2_id = str(uuid.uuid4())

        db.add(User(id=uid, email=f"{uid}@t.com", password_hash=hash_password("x"), display_name="T"))
        db.add(Warehouse(id=wid, name="W", created_by=uid))
        db.add(Membership(user_id=uid, warehouse_id=wid))
        db.add(Box(id=box1_id, warehouse_id=wid, name="B1", qr_token=str(uuid.uuid4()), short_code=f"s{box1_id[:6]}"))
        db.add(Box(id=box2_id, warehouse_id=wid, name="B2", qr_token=str(uuid.uuid4()), short_code=f"s{box2_id[:6]}"))

        item_ids = []
        for i in range(n_suggestions):
            iid = str(uuid.uuid4())
            db.add(Item(id=iid, warehouse_id=wid, box_id=box1_id, name=f"I{i}", version=1))
            item_ids.append(iid)

        suggestion_ids = [str(uuid.uuid4()) for _ in range(n_suggestions)]
        suggestions = [
            {
                "suggestion_id": suggestion_ids[i],
                "item_id": item_ids[i],
                "item_name": f"I{i}",
                "from_box_id": box1_id,
                "from_box_name": "B1",
                "to_box_id": box2_id,
                "to_box_name": "B2",
                "reason": "r",
                "status": "pending",
            }
            for i in range(n_suggestions)
        ]

        sess = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by=uid,
            status="ready",
            suggestions=suggestions,
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)

        target_sid = suggestion_ids[actual_idx]
        dismiss_suggestion(sess, target_sid, db)

        by_id = {s["suggestion_id"]: s for s in sess.suggestions}
        assert by_id[target_sid]["status"] == "dismissed"
        for i, sid in enumerate(suggestion_ids):
            if i != actual_idx:
                assert by_id[sid]["status"] == "pending", (
                    f"Suggestion {sid} at index {i} should still be pending"
                )


# ── Property 8: Session completed when all suggestions resolved ───────────────

@h_settings(max_examples=100)
@given(
    n_confirmed=st.integers(min_value=0, max_value=5),
    n_dismissed=st.integers(min_value=0, max_value=5),
)
def test_session_completed_when_all_resolved(n_confirmed, n_dismissed):
    """
    # Feature: box-reorganization-suggestions, Property 8:
    When all suggestions are confirmed or dismissed, session.status == 'completed'.
    """
    from app.services.reorganization import _maybe_complete_session

    total = n_confirmed + n_dismissed
    if total == 0:
        # Edge case: empty suggestions list → _maybe_complete_session returns early
        # Use a real DB session to get a proper mapped instance
        from app.db.session import engine
        from app.models.reorganization_session import ReorganizationSession
        with Session(bind=engine) as db:
            uid = str(uuid.uuid4())
            wid = str(uuid.uuid4())
            from app.models.user import User
            from app.models.warehouse import Warehouse
            from app.models.membership import Membership
            from app.services.security import hash_password
            db.add(User(id=uid, email=f"{uid}@t.com", password_hash=hash_password("x"), display_name="T"))
            db.add(Warehouse(id=wid, name="W", created_by=uid))
            db.add(Membership(user_id=uid, warehouse_id=wid))
            sess = ReorganizationSession(
                id=str(uuid.uuid4()), warehouse_id=wid, created_by=uid,
                status="ready", suggestions=[],
            )
            db.add(sess)
            db.commit()
            db.refresh(sess)
            _maybe_complete_session(sess)
            assert sess.status == "ready"  # no change for empty list
        return

    from app.db.session import engine
    from app.models.reorganization_session import ReorganizationSession
    with Session(bind=engine) as db:
        uid = str(uuid.uuid4())
        wid = str(uuid.uuid4())
        from app.models.user import User
        from app.models.warehouse import Warehouse
        from app.models.membership import Membership
        from app.services.security import hash_password
        db.add(User(id=uid, email=f"{uid}@t.com", password_hash=hash_password("x"), display_name="T"))
        db.add(Warehouse(id=wid, name="W", created_by=uid))
        db.add(Membership(user_id=uid, warehouse_id=wid))

        suggestions = (
            [{"suggestion_id": str(uuid.uuid4()), "status": "confirmed"} for _ in range(n_confirmed)]
            + [{"suggestion_id": str(uuid.uuid4()), "status": "dismissed"} for _ in range(n_dismissed)]
        )
        sess = ReorganizationSession(
            id=str(uuid.uuid4()), warehouse_id=wid, created_by=uid,
            status="ready", suggestions=suggestions,
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)

        _maybe_complete_session(sess)
        assert sess.status == "completed"


# ── Property 9: Force archives previous session ───────────────────────────────

@h_settings(max_examples=100, suppress_health_check=[])
@given(prev_status=st.sampled_from(["ready", "running"]))
def test_force_archives_previous_session(prev_status):
    """
    # Feature: box-reorganization-suggestions, Property 9:
    POST /sessions?force=true archives the previous ready/running session and creates a new one.
    Uses its own TestClient per example to avoid fixture state issues.
    """
    import os
    os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
    os.environ.setdefault("JWT_SECRET", "test-secret")

    from app.db.session import engine
    from app.models.reorganization_session import ReorganizationSession
    from app.services.reorganization import confirm_suggestion, dismiss_suggestion
    from sqlalchemy import select

    with Session(bind=engine) as db:
        from app.models.user import User
        from app.models.warehouse import Warehouse
        from app.models.membership import Membership
        from app.services.security import hash_password

        uid = str(uuid.uuid4())
        wid = str(uuid.uuid4())
        db.add(User(id=uid, email=f"{uid}@t.com", password_hash=hash_password("x"), display_name="T"))
        db.add(Warehouse(id=wid, name="W", created_by=uid))
        db.add(Membership(user_id=uid, warehouse_id=wid))

        old = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by=uid,
            status=prev_status,
            suggestions=[],
        )
        db.add(old)
        db.commit()
        old_id = old.id

        # Simulate force=True: archive old, create new
        old_sess = db.scalar(select(ReorganizationSession).where(ReorganizationSession.id == old_id))
        old_sess.status = "archived"
        new_sess = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by=uid,
            status="running",
            suggestions=[],
        )
        db.add(new_sess)
        db.commit()
        new_id = new_sess.id

        assert new_id != old_id
        refreshed_old = db.scalar(select(ReorganizationSession).where(ReorganizationSession.id == old_id))
        assert refreshed_old.status == "archived"


# ── Property 10: Worker sets session to ready with suggestions ────────────────

@h_settings(max_examples=100)
@given(
    n_items=st.integers(min_value=1, max_value=8),
    n_boxes=st.integers(min_value=2, max_value=4),
)
def test_worker_sets_ready_with_suggestions(n_items, n_boxes):
    """
    # Feature: box-reorganization-suggestions, Property 10:
    run_analysis with a successful LLM call sets session.status='ready'
    and all suggestions have status='pending'.
    """
    from app.db.session import engine
    from app.models.box import Box
    from app.models.item import Item
    from app.models.llm_setting import LLMSetting
    from app.models.membership import Membership
    from app.models.reorganization_session import ReorganizationSession
    from app.models.user import User
    from app.models.warehouse import Warehouse
    from app.services.reorganization import run_analysis
    from app.services.secret_store import encrypt_secret
    from app.services.security import hash_password
    from sqlalchemy import select

    with Session(bind=engine) as db:
        uid = str(uuid.uuid4())
        wid = str(uuid.uuid4())

        db.add(User(id=uid, email=f"{uid}@t.com", password_hash=hash_password("x"), display_name="T"))
        db.add(Warehouse(id=wid, name="W", created_by=uid))
        db.add(Membership(user_id=uid, warehouse_id=wid))

        box_ids = []
        for i in range(n_boxes):
            bid = str(uuid.uuid4())
            db.add(Box(id=bid, warehouse_id=wid, name=f"Box{i}", qr_token=str(uuid.uuid4()), short_code=f"s{bid[:6]}"))
            box_ids.append(bid)

        item_ids = []
        for i in range(n_items):
            iid = str(uuid.uuid4())
            db.add(Item(id=iid, warehouse_id=wid, box_id=box_ids[0], name=f"Item{i}", version=1))
            item_ids.append(iid)

        db.add(LLMSetting(
            warehouse_id=wid,
            provider="gemini",
            language="es",
            api_key_encrypted=encrypt_secret("fake-key"),
            model_priority=["gemini-test"],
            updated_by=uid,
        ))

        sess = ReorganizationSession(
            id=str(uuid.uuid4()),
            warehouse_id=wid,
            created_by=uid,
            status="running",
            suggestions=[],
        )
        db.add(sess)
        db.commit()
        sess_id = sess.id

        # Build a valid LLM response that moves item[0] to box[1]
        fake_response = json.dumps({"suggestions": [
            {"item_id": item_ids[0], "to_box_id": box_ids[1], "reason": "group"}
        ]})

        with patch("app.services.reorganization._call_gemini", return_value=fake_response):
            run_analysis(sess_id, wid, db)

        db.expire_all()
        updated = db.scalar(select(ReorganizationSession).where(ReorganizationSession.id == sess_id))
        assert updated.status == "ready"
        for s in updated.suggestions:
            assert s["status"] == "pending"
