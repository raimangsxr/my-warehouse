from collections.abc import Sequence
from typing import Literal, cast


GeminiModelId = Literal[
    "gemini-3.1-flash-lite",
    "gemini-3-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
]

SUPPORTED_GEMINI_MODELS: tuple[GeminiModelId, ...] = (
    "gemini-3.1-flash-lite",
    "gemini-3-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
)

DEFAULT_GEMINI_MODEL_PRIORITY: tuple[GeminiModelId, ...] = SUPPORTED_GEMINI_MODELS

GEMINI_MODEL_LABELS: dict[GeminiModelId, str] = {
    "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
    "gemini-3-flash": "Gemini 3 Flash",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
}


def normalize_model_priority(raw_priority: Sequence[str] | None) -> list[GeminiModelId]:
    if not raw_priority:
        return list(DEFAULT_GEMINI_MODEL_PRIORITY)

    normalized = [str(model).strip() for model in raw_priority if str(model).strip()]
    if len(normalized) != len(SUPPORTED_GEMINI_MODELS):
        return list(DEFAULT_GEMINI_MODEL_PRIORITY)
    if len(set(normalized)) != len(SUPPORTED_GEMINI_MODELS):
        return list(DEFAULT_GEMINI_MODEL_PRIORITY)
    if set(normalized) != set(SUPPORTED_GEMINI_MODELS):
        return list(DEFAULT_GEMINI_MODEL_PRIORITY)
    return [cast(GeminiModelId, model) for model in normalized]
