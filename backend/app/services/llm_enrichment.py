import json
import logging
import re
import unicodedata
from base64 import b64decode
from binascii import Error as BinasciiError
from collections.abc import Sequence
from uuid import uuid4
from urllib import error, request

from app.core.llm import DEFAULT_GEMINI_MODEL_PRIORITY, SUPPORTED_GEMINI_MODELS, GeminiModelId, normalize_model_priority


logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = DEFAULT_GEMINI_MODEL_PRIORITY[0]
GEMINI_GENERATE_CONTENT_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_OUTPUT_LANGUAGE = "es"


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


def _new_llm_operation_id() -> str:
    return uuid4().hex[:10]


def _short_exception(exc: Exception) -> str:
    return " ".join(str(exc).strip().split())[:240] or exc.__class__.__name__


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


def _parse_json_object(raw: str) -> dict[str, object]:
    candidate = raw.strip()
    if not candidate:
        raise ValueError("Gemini response did not include JSON content")

    decoder = json.JSONDecoder()

    for source in (candidate, _extract_json_fragment(candidate)):
        if not source:
            continue
        # Try strict parse first.
        try:
            parsed = json.loads(source)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        # Fallback: parse first valid JSON object and ignore trailing text.
        for start in range(len(source)):
            if source[start] != "{":
                continue
            try:
                parsed, _end = decoder.raw_decode(source, start)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                return parsed

    raise ValueError("Gemini response is not a valid JSON object")


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


def _parse_data_url(image_data_url: str) -> tuple[str, str]:
    if not image_data_url.startswith("data:"):
        raise ValueError("image_data_url must be a data URL")
    header, sep, payload = image_data_url.partition(",")
    if not sep:
        raise ValueError("Invalid data URL")
    if ";base64" not in header:
        raise ValueError("image_data_url must be base64 encoded")

    mime_type = header[5:].split(";")[0].strip().lower()
    if not mime_type.startswith("image/"):
        raise ValueError("image_data_url must contain an image mime type")
    if mime_type not in {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}:
        raise ValueError("Unsupported image mime type")

    try:
        b64decode(payload, validate=True)
    except (BinasciiError, ValueError) as exc:
        raise ValueError("Invalid base64 image payload") from exc
    return mime_type, payload


def _sanitize_title(raw: str, *, default_title: str) -> str:
    normalized = " ".join(raw.strip().split())
    if not normalized:
        return default_title
    return normalized[:160]


def _sanitize_description(raw: str | None) -> str | None:
    if raw is None:
        return None
    normalized = " ".join(raw.strip().split())
    if not normalized:
        return None
    return normalized[:1000]


def _parse_confidence(raw: object, *, default: float) -> float:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return default
    return max(0.0, min(1.0, value))


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


def _resolve_output_language(output_language: str | None) -> str:
    normalized = (output_language or DEFAULT_OUTPUT_LANGUAGE).strip().lower()
    if normalized not in {"es", "en"}:
        return DEFAULT_OUTPUT_LANGUAGE
    return normalized


def _language_instruction(output_language: str) -> str:
    if output_language == "en":
        return "Write every generated value in English."
    return "Escribe todos los valores generados en espanol."


def _resolve_model_priority(
    model_priority: Sequence[str] | None,
    preferred_model: str,
) -> list[GeminiModelId]:
    if model_priority:
        return normalize_model_priority(model_priority)

    preferred = str(preferred_model).strip()
    if preferred and preferred in SUPPORTED_GEMINI_MODELS:
        ordered = [preferred, *[model for model in DEFAULT_GEMINI_MODEL_PRIORITY if model != preferred]]
        return normalize_model_priority(ordered)

    return list(DEFAULT_GEMINI_MODEL_PRIORITY)


_RUNTIME_MODEL_CANDIDATES: dict[str, tuple[str, ...]] = {
    "gemini-3.1-flash-lite": (
        "gemini-3.1-flash-lite",
        "gemini-3.1-flash-lite-preview",
        "gemini-3.1-flash-lite-latest",
        "gemini-3.1-flash-lite-preview-latest",
    ),
    "gemini-3-flash": (
        "gemini-3-flash",
        "gemini-3-flash-preview",
        "gemini-3-flash-latest",
        "gemini-3-flash-preview-latest",
    ),
    "gemini-2.5-flash": (
        "gemini-2.5-flash",
        "gemini-2.5-flash-latest",
        "gemini-2.5-flash-preview-latest",
    ),
    "gemini-2.5-flash-lite": (
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash-lite-latest",
        "gemini-2.5-flash-lite-preview-latest",
    ),
}


def _runtime_model_candidates(configured_model: str) -> list[str]:
    base = str(configured_model).strip()
    if not base:
        return []

    candidates = list(_RUNTIME_MODEL_CANDIDATES.get(base, (base,)))
    generic = [base, f"{base}-preview", f"{base}-latest", f"{base}-preview-latest"]
    for candidate in generic:
        if candidate not in candidates:
            candidates.append(candidate)
    return candidates


def _heuristic_photo_draft(
    image_mime_type: str,
    output_language: str,
    *,
    context_name: str | None = None,
    context_description: str | None = None,
) -> dict[str, object]:
    mime_hint = {
        "image/jpeg": "foto",
        "image/png": "imagen",
        "image/webp": "captura",
    }.get(image_mime_type, "foto")
    fallback_name = "Unidentified item" if output_language == "en" else "Articulo sin identificar"
    name = _sanitize_title(context_name or "", default_title=fallback_name)
    description_hint = _sanitize_description(context_description)
    if output_language == "en":
        tags = _normalize_output_values(["photo", "inventory", "pending", "review"], max_count=10)
        return {
            "name": name,
            "description": description_hint
            or "Generated from photo. Review name, description, tags, and aliases before saving.",
            "tags": tags,
            "aliases": [],
            "confidence": 0.2,
            "warnings": ["The item could not be inferred with LLM; local fallback was used."],
            "llm_used": False,
        }

    tags = _normalize_output_values([mime_hint, "inventario", "pendiente", "revision"], max_count=10)
    return {
        "name": name,
        "description": description_hint
        or "Generado desde foto. Revisa nombre, descripcion, tags y aliases antes de guardar.",
        "tags": tags,
        "aliases": [],
        "confidence": 0.2,
        "warnings": ["No se pudo inferir el item con LLM; se aplico fallback local."],
        "llm_used": False,
    }


def _gemini_tags_and_aliases(
    *,
    api_key: str,
    model: str,
    name: str,
    description: str | None,
    output_language: str,
    timeout_seconds: float,
) -> tuple[list[str], list[str]]:
    prompt = (
        "Extract concise search metadata for a warehouse inventory item.\n"
        "Return only JSON with this shape: {\"tags\": string[], \"aliases\": string[]}.\n"
        "Rules:\n"
        "- Use only the item name and description provided.\n"
        f"- {_language_instruction(output_language)}\n"
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

    parsed = _parse_json_object(text)

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


def _gemini_photo_draft(
    *,
    api_key: str,
    model: str,
    image_mime_type: str,
    image_b64_data: str,
    output_language: str,
    context_name: str | None,
    context_description: str | None,
    timeout_seconds: float,
) -> dict[str, object]:
    prompt = (
        "You classify inventory items from photos for a warehouse app.\n"
        "Return only JSON with shape:\n"
        "{\"name\": string, \"description\": string, \"tags\": string[], \"aliases\": string[], \"confidence\": number, \"warnings\": string[]}\n"
        "Rules:\n"
        f"- {_language_instruction(output_language)}\n"
        "- Identify only one object: the main item in the foreground and most in focus.\n"
        "- Ignore secondary objects, supports, surfaces, background, and scene context.\n"
        "- Example: if a phone is on a mat, classify only the phone.\n"
        "- name: short, human-readable item name.\n"
        "- description: one concise sentence for search context.\n"
        "- tags: 3-10 lowercase tokens, no duplicates.\n"
        "- aliases: 0-5 lowercase alternatives, no duplicates, not equal to name.\n"
        "- confidence: number between 0 and 1.\n"
        "- warnings: empty array unless the image is ambiguous."
    )
    if context_name:
        prompt += f"\nContext name hint from user/workflow: {context_name.strip()[:160]}"
    if context_description:
        prompt += f"\nContext description hint from user/workflow: {context_description.strip()[:400]}"
    if context_name:
        prompt += "\nIf a context name is provided, use that exact value for the output field `name`."
    elif context_description:
        prompt += "\nUse context hints only if consistent with the photo."
    url = GEMINI_GENERATE_CONTENT_URL.format(model=model)
    body = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": image_mime_type, "data": image_b64_data}},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.15,
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

    parsed = _parse_json_object(text)

    default_title = "Unidentified item" if output_language == "en" else "Articulo sin identificar"
    context_name_hint = _sanitize_title(str(context_name or ""), default_title="") if context_name else ""
    name = context_name_hint or _sanitize_title(str(parsed.get("name") or ""), default_title=default_title)
    description = _sanitize_description(str(parsed.get("description") or "")) or _sanitize_description(context_description)
    normalized_name = _normalize_text(name)
    raw_tags = parsed.get("tags") if isinstance(parsed.get("tags"), list) else []
    raw_aliases = parsed.get("aliases") if isinstance(parsed.get("aliases"), list) else []
    raw_warnings = parsed.get("warnings") if isinstance(parsed.get("warnings"), list) else []

    tags = _normalize_output_values([str(value) for value in raw_tags], max_count=10)
    aliases = _normalize_output_values(
        [str(value) for value in raw_aliases],
        max_count=5,
        drop_value=normalized_name,
    )
    warnings = [
        " ".join(str(entry).strip().split())[:180]
        for entry in raw_warnings
        if str(entry).strip()
    ][:4]
    confidence = _parse_confidence(parsed.get("confidence"), default=0.7)

    if len(tags) < 3:
        # Ensure minimum search hints even if the model under-returns tags.
        fallback_tag = "inventory" if output_language == "en" else "inventario"
        tags = _normalize_output_values(
            tags + _tokenize(f"{name} {description or ''}") + [fallback_tag],
            max_count=10,
        )

    return {
        "name": name,
        "description": description,
        "tags": tags,
        "aliases": aliases,
        "confidence": confidence,
        "warnings": warnings,
        "llm_used": True,
    }


def generate_tags_and_aliases(
    name: str,
    description: str | None,
    *,
    api_key: str | None = None,
    output_language: str = DEFAULT_OUTPUT_LANGUAGE,
    model: str = DEFAULT_GEMINI_MODEL,
    model_priority: Sequence[str] | None = None,
    timeout_seconds: float = 8.0,
) -> tuple[list[str], list[str]]:
    resolved_language = _resolve_output_language(output_language)
    models_to_try = _resolve_model_priority(model_priority, model)
    operation_id = _new_llm_operation_id()
    logger.info(
        "LLM tags request started op=%s has_api_key=%s language=%s configured_models=%s",
        operation_id,
        bool(api_key),
        resolved_language,
        list(models_to_try),
    )
    if api_key:
        for configured_idx, configured_model in enumerate(models_to_try, start=1):
            runtime_models = _runtime_model_candidates(configured_model)
            logger.debug(
                "LLM tags configured model attempt op=%s configured_step=%s/%s configured_model=%s runtime_candidates=%s",
                operation_id,
                configured_idx,
                len(models_to_try),
                configured_model,
                runtime_models,
            )
            for runtime_idx, runtime_model in enumerate(runtime_models, start=1):
                logger.debug(
                    "LLM tags runtime attempt op=%s configured_model=%s runtime_step=%s/%s runtime_model=%s",
                    operation_id,
                    configured_model,
                    runtime_idx,
                    len(runtime_models),
                    runtime_model,
                )
                try:
                    tags, aliases = _gemini_tags_and_aliases(
                        api_key=api_key,
                        model=runtime_model,
                        name=name,
                        description=description,
                        output_language=resolved_language,
                        timeout_seconds=timeout_seconds,
                    )
                    if tags:
                        logger.info(
                            "LLM tags request resolved op=%s winner_configured_model=%s winner_runtime_model=%s "
                            "configured_step=%s/%s runtime_step=%s/%s tags=%s aliases=%s",
                            operation_id,
                            configured_model,
                            runtime_model,
                            configured_idx,
                            len(models_to_try),
                            runtime_idx,
                            len(runtime_models),
                            len(tags),
                            len(aliases),
                        )
                        return tags, aliases
                    raise ValueError("Gemini returned empty tags")
                except (error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
                    is_not_found = isinstance(exc, error.HTTPError) and exc.code == 404
                    if is_not_found and runtime_idx < len(runtime_models):
                        # Same logical model may be exposed as preview/latest alias.
                        logger.error(
                            "LLM tags runtime failed op=%s configured_model=%s runtime_model=%s reason=%s "
                            "fallback=next_runtime_alias",
                            operation_id,
                            configured_model,
                            runtime_model,
                            _short_exception(exc),
                        )
                        continue
                    has_next_configured = configured_idx < len(models_to_try)
                    logger.error(
                        "LLM tags runtime failed op=%s configured_model=%s runtime_model=%s reason=%s "
                        "fallback=%s",
                        operation_id,
                        configured_model,
                        runtime_model,
                        _short_exception(exc),
                        "next_configured_model" if has_next_configured else "heuristic_fallback",
                    )
                    logger.error(
                        "Gemini model %s (configured as %s) failed for tags/aliases: %s",
                        runtime_model,
                        configured_model,
                        exc,
                    )
                    break

    tags, aliases = _heuristic_tags_and_aliases(name, description)
    logger.error(
        "LLM tags request resolved via heuristic fallback op=%s tags=%s aliases=%s",
        operation_id,
        len(tags),
        len(aliases),
    )
    return tags, aliases


def generate_item_draft_from_photo(
    image_data_url: str,
    *,
    api_key: str | None = None,
    output_language: str = DEFAULT_OUTPUT_LANGUAGE,
    context_name: str | None = None,
    context_description: str | None = None,
    model: str = DEFAULT_GEMINI_MODEL,
    model_priority: Sequence[str] | None = None,
    timeout_seconds: float = 10.0,
) -> dict[str, object]:
    resolved_language = _resolve_output_language(output_language)
    models_to_try = _resolve_model_priority(model_priority, model)
    operation_id = _new_llm_operation_id()
    image_mime_type, image_b64_data = _parse_data_url(image_data_url)
    fallback = _heuristic_photo_draft(
        image_mime_type,
        resolved_language,
        context_name=context_name,
        context_description=context_description,
    )
    logger.info(
        "LLM photo draft request started op=%s has_api_key=%s language=%s image_mime=%s configured_models=%s "
        "has_context_name=%s has_context_description=%s",
        operation_id,
        bool(api_key),
        resolved_language,
        image_mime_type,
        list(models_to_try),
        bool(context_name),
        bool(context_description),
    )

    if api_key:
        for configured_idx, configured_model in enumerate(models_to_try, start=1):
            runtime_models = _runtime_model_candidates(configured_model)
            logger.debug(
                "LLM photo draft configured model attempt op=%s configured_step=%s/%s configured_model=%s "
                "runtime_candidates=%s",
                operation_id,
                configured_idx,
                len(models_to_try),
                configured_model,
                runtime_models,
            )
            for runtime_idx, runtime_model in enumerate(runtime_models, start=1):
                logger.debug(
                    "LLM photo draft runtime attempt op=%s configured_model=%s runtime_step=%s/%s runtime_model=%s",
                    operation_id,
                    configured_model,
                    runtime_idx,
                    len(runtime_models),
                    runtime_model,
                )
                try:
                    draft = _gemini_photo_draft(
                        api_key=api_key,
                        model=runtime_model,
                        image_mime_type=image_mime_type,
                        image_b64_data=image_b64_data,
                        output_language=resolved_language,
                        context_name=context_name,
                        context_description=context_description,
                        timeout_seconds=timeout_seconds,
                    )
                    if draft.get("name") and draft.get("tags"):
                        logger.info(
                            "LLM photo draft request resolved op=%s winner_configured_model=%s winner_runtime_model=%s "
                            "configured_step=%s/%s runtime_step=%s/%s tags=%s confidence=%.3f",
                            operation_id,
                            configured_model,
                            runtime_model,
                            configured_idx,
                            len(models_to_try),
                            runtime_idx,
                            len(runtime_models),
                            len(draft.get("tags") or []),
                            float(draft.get("confidence") or 0.0),
                        )
                        return draft
                    raise ValueError("Gemini photo draft did not include required fields")
                except (error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
                    is_not_found = isinstance(exc, error.HTTPError) and exc.code == 404
                    if is_not_found and runtime_idx < len(runtime_models):
                        # Same logical model may be exposed as preview/latest alias.
                        logger.error(
                            "LLM photo draft runtime failed op=%s configured_model=%s runtime_model=%s reason=%s "
                            "fallback=next_runtime_alias",
                            operation_id,
                            configured_model,
                            runtime_model,
                            _short_exception(exc),
                        )
                        continue
                    has_next_configured = configured_idx < len(models_to_try)
                    logger.error(
                        "LLM photo draft runtime failed op=%s configured_model=%s runtime_model=%s reason=%s "
                        "fallback=%s",
                        operation_id,
                        configured_model,
                        runtime_model,
                        _short_exception(exc),
                        "next_configured_model" if has_next_configured else "heuristic_fallback",
                    )
                    logger.error(
                        "Gemini model %s (configured as %s) failed for photo draft: %s",
                        runtime_model,
                        configured_model,
                        exc,
                    )
                    break

    logger.error("LLM photo draft request resolved via heuristic fallback op=%s", operation_id)
    return fallback
