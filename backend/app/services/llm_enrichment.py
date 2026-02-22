import re
import unicodedata


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


def generate_tags_and_aliases(name: str, description: str | None) -> tuple[list[str], list[str]]:
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
