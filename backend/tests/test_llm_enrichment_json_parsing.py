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
