from urllib import error

from app.services import llm_enrichment
from app.services.llm_enrichment import _parse_json_object


def test_parse_json_object_accepts_trailing_text():
    raw = '{"name":"Telefono","tags":["telefono","movil","electronica"]}\nNota adicional'
    parsed = _parse_json_object(raw)
    assert parsed["name"] == "Telefono"


def test_parse_json_object_accepts_markdown_wrapped_json():
    raw = "```json\n{\"name\":\"Martillo\",\"tags\":[\"martillo\",\"herramienta\",\"metal\"]}\n```"
    parsed = _parse_json_object(raw)
    assert parsed["name"] == "Martillo"


def test_parse_json_object_raises_on_invalid_payload():
    raw = "respuesta sin json estructurado"
    try:
        _parse_json_object(raw)
    except ValueError as exc:
        assert "valid JSON object" in str(exc)
        return
    raise AssertionError("Expected ValueError for invalid payload")


def test_generate_tags_uses_next_model_when_first_fails(monkeypatch):
    attempted_models: list[str] = []

    def fake_gemini(*, model: str, **_kwargs):
        attempted_models.append(model)
        if model == "gemini-3.1-flash-lite":
            raise ValueError("Rate limited")
        return ["herramienta", "taladro", "bateria"], ["drill"]

    monkeypatch.setattr(llm_enrichment, "_gemini_tags_and_aliases", fake_gemini)

    tags, aliases = llm_enrichment.generate_tags_and_aliases(
        "Taladro",
        "Inalambrico",
        api_key="secret",
    )

    assert attempted_models[:2] == ["gemini-3.1-flash-lite", "gemini-3-flash"]
    assert tags == ["herramienta", "taladro", "bateria"]
    assert aliases == ["drill"]


def test_generate_photo_draft_uses_custom_priority_order(monkeypatch):
    attempted_models: list[str] = []

    def fake_photo(*, model: str, **_kwargs):
        attempted_models.append(model)
        if model == "gemini-2.5-flash":
            raise ValueError("Quota exceeded")
        return {
            "name": "Taladro",
            "description": "Herramienta electrica.",
            "tags": ["taladro", "herramienta", "bateria"],
            "aliases": ["drill"],
            "confidence": 0.91,
            "warnings": [],
            "llm_used": True,
        }

    monkeypatch.setattr(llm_enrichment, "_gemini_photo_draft", fake_photo)

    draft = llm_enrichment.generate_item_draft_from_photo(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3JjNQAAAAASUVORK5CYII=",
        api_key="secret",
        model_priority=[
            "gemini-2.5-flash",
            "gemini-3-flash",
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash-lite",
        ],
    )

    assert attempted_models[:2] == ["gemini-2.5-flash", "gemini-3-flash"]
    assert draft["llm_used"] is True
    assert draft["name"] == "Taladro"


def test_generate_photo_draft_tries_preview_alias_on_404(monkeypatch):
    attempted_models: list[str] = []

    def fake_photo(*, model: str, **_kwargs):
        attempted_models.append(model)
        if model == "gemini-3-flash":
            raise error.HTTPError(url="https://example.invalid", code=404, msg="Not Found", hdrs=None, fp=None)
        if model == "gemini-3-flash-preview":
            return {
                "name": "Taladro",
                "description": "Herramienta electrica.",
                "tags": ["taladro", "herramienta", "bateria"],
                "aliases": ["drill"],
                "confidence": 0.91,
                "warnings": [],
                "llm_used": True,
            }
        raise AssertionError(f"Unexpected model candidate {model}")

    monkeypatch.setattr(llm_enrichment, "_gemini_photo_draft", fake_photo)

    draft = llm_enrichment.generate_item_draft_from_photo(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3JjNQAAAAASUVORK5CYII=",
        api_key="secret",
        model_priority=[
            "gemini-3-flash",
            "gemini-2.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash-lite",
        ],
    )

    assert attempted_models == ["gemini-3-flash", "gemini-3-flash-preview"]
    assert draft["name"] == "Taladro"
    assert draft["llm_used"] is True
