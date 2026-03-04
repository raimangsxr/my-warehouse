import json
import logging
import re
import unicodedata
from urllib import error, request


logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite"
GEMINI_GENERATE_CONTENT_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


_STOPWORDS = {
    "the",
    "and",
    "for",
    "con",
    "sin",
    "para",
    "una",
    "unos",
    "unas",
    "este",
    "esta",
    "that",
    "from",
    "with",
    "garaje",
}


def _normalize_text(raw: str) -> str:
    normalized = unicodedata.normalize("NFKD", raw)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch)).lower()


def _tokenize(raw: str) -> list[str]:
    text = _normalize_text(raw)
    return [token for token in re.findall(r"[a-z0-9]{3,}", text) if token not in _STOPWORDS]


def _extract_json_fragment(raw: str) -> str:
    candidate = raw.strip()
    if candidate.startswith("{") and candidate.endswith("}"):
        return candidate

    match = re.search(r"\{.*\}", candidate, flags=re.DOTALL)
    if match:
        return match.group(0)
    return candidate


def _normalize_output_values(values: list[str], *, max_count: int, drop_value: str | None = None) -> list[str]:
    unique: list[str] = []
    for value in values:
        normalized = _normalize_text(value)
        if not normalized:
            continue
        if drop_value and normalized == drop_value:
            continue
        if normalized not in unique:
            unique.append(normalized)
        if len(unique) >= max_count:
            break
    return unique


def _heuristic_tags_and_aliases(name: str, description: str | None) -> tuple[list[str], list[str]]:
    source = f"{name} {description or ''}".strip()
    tokens = _tokenize(source)

    tags: list[str] = []
    for token in tokens:
        if token not in tags:
            tags.append(token)
        if len(tags) >= 8:
            break

    normalized_name = _normalize_text(name)
    name_tokens = [tok for tok in _tokenize(name) if tok]
    aliases: list[str] = []
    if name_tokens:
        aliases.append("-".join(name_tokens[:2]))
    if len(name_tokens) >= 2:
        aliases.append(" ".join(name_tokens[:2]))
    if normalized_name and normalized_name not in aliases:
        aliases.append(normalized_name)

    aliases = [alias for alias in aliases if alias and alias != normalized_name][:5]
    return tags[:10], aliases[:5]


def _gemini_tags_and_aliases(
    *,
    api_key: str,
    model: str,
    name: str,
    description: str | None,
    timeout_seconds: float,
) -> tuple[list[str], list[str]]:
    prompt = (
        "Extract concise search metadata for a warehouse inventory item.\n"
        "Return only JSON with this shape: {\"tags\": string[], \"aliases\": string[]}.\n"
        "Rules:\n"
        "- Use only the item name and description provided.\n"
        "- tags: 3-10 lowercase tokens, no duplicates, useful for categorization.\n"
        "- aliases: 0-5 lowercase alternatives, no duplicates, do not repeat the full item name.\n"
        "Item name: "
        f"{name}\n"
        f"Item description: {description or ''}"
    )
    url = GEMINI_GENERATE_CONTENT_URL.format(model=model)
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
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

    text = ""
    candidates = payload.get("candidates") or []
    if candidates:
        parts = ((candidates[0].get("content") or {}).get("parts") or [])
        if parts:
            text = str(parts[0].get("text") or "")
    if not text:
        raise ValueError("Gemini response did not include text")

    parsed = json.loads(_extract_json_fragment(text))
    if not isinstance(parsed, dict):
        raise ValueError("Gemini response is not a JSON object")

    raw_tags = parsed.get("tags")
    raw_aliases = parsed.get("aliases")
    if not isinstance(raw_tags, list) or not isinstance(raw_aliases, list):
        raise ValueError("Gemini JSON does not include valid tags/aliases arrays")

    normalized_name = _normalize_text(name)
    tags = _normalize_output_values([str(value) for value in raw_tags], max_count=10)
    aliases = _normalize_output_values(
        [str(value) for value in raw_aliases],
        max_count=5,
        drop_value=normalized_name,
    )
    return tags, aliases


def generate_tags_and_aliases(
    name: str,
    description: str | None,
    *,
    api_key: str | None = None,
    model: str = DEFAULT_GEMINI_MODEL,
    timeout_seconds: float = 8.0,
) -> tuple[list[str], list[str]]:
    if api_key:
        try:
            tags, aliases = _gemini_tags_and_aliases(
                api_key=api_key,
                model=model,
                name=name,
                description=description,
                timeout_seconds=timeout_seconds,
            )
            if tags:
                return tags, aliases
        except (error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            logger.warning("Gemini enrichment failed, using heuristic fallback: %s", exc)

    return _heuristic_tags_and_aliases(name, description)
