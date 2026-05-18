"""
LLM-backed assistant powered by OpenAI's API.

Two endpoints feed off this module:
    - explain_error  → natural-language diagnosis of a parser error,
                       tailored to the user's grammar and input string.
    - recommend      → suggest concrete transformations (left-recursion
                       removal, factoring, etc.) to make the grammar work
                       with the chosen parser.

The OpenAI API key is read exclusively from the OPENAI_API_KEY env var.
It is NEVER committed to the repo. If the var is missing or empty, the
endpoints return a structured error so the frontend can fall back to its
local heuristic explanations gracefully.
"""
from __future__ import annotations

import os
from typing import Any

# Model + budget configuration (cheap defaults for educational demo)
_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
_MAX_OUTPUT_TOKENS = 600
_TIMEOUT_SECONDS   = 25     # well under Vercel's 30s function limit


_SYSTEM_PROMPT = (
    "Eres un profesor universitario de Compiladores. Hablas en español, "
    "claro y directo. Tu trabajo es ayudar a un estudiante a entender lo "
    "que pasó con su parser. Responde con un máximo de 3 párrafos cortos. "
    "Nunca uses markdown (ni asteriscos, ni hashtags). Usa frases breves. "
    "Sé didáctico pero conciso — el estudiante ya tiene el contexto "
    "técnico, no necesita teoría general, necesita entender SU caso."
)


def _client():
    """Lazily build the OpenAI client. Returns (client, error_message)."""
    api_key = os.environ.get('OPENAI_API_KEY', '').strip()
    if not api_key:
        return None, (
            "La clave de OpenAI no está configurada en el servidor "
            "(OPENAI_API_KEY). Define la variable de entorno en Vercel y "
            "vuelve a intentarlo. Mientras tanto puedes usar el asistente "
            "heurístico local."
        )
    try:
        from openai import OpenAI
    except ImportError:
        return None, (
            "La librería 'openai' no está instalada en el servidor. "
            "Reinstala las dependencias del backend."
        )
    try:
        return OpenAI(api_key=api_key, timeout=_TIMEOUT_SECONDS), None
    except Exception as exc:
        return None, f"No se pudo inicializar el cliente de OpenAI: {exc}"


def _call(prompt: str) -> tuple[str | None, str | None]:
    """Single-shot chat completion. Returns (text, error_message)."""
    client, err = _client()
    if err:
        return None, err

    try:
        resp = client.chat.completions.create(
            model=_MODEL,
            max_tokens=_MAX_OUTPUT_TOKENS,
            temperature=0.4,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": prompt},
            ],
        )
    except Exception as exc:
        # Catches RateLimit, AuthError, APIError, Timeout, …
        return None, f"Fallo al llamar a OpenAI: {type(exc).__name__}: {exc}"

    try:
        text = resp.choices[0].message.content or ''
    except (IndexError, AttributeError) as exc:
        return None, f"Respuesta inesperada del modelo: {exc}"

    text = text.strip()
    if not text:
        return None, "El modelo devolvió una respuesta vacía."

    return text, None


# ─────────────────────────────────────────── public API

def explain_error(
    *,
    parser_label: str,
    grammar: str,
    tokens: list[str],
    error_message: str,
) -> dict[str, Any]:
    """Ask the LLM to explain a parser error in natural Spanish."""
    tokens_str = ' '.join(tokens) if tokens else '(sin tokens)'
    prompt = (
        f"PARSER:  {parser_label}\n\n"
        f"GRAMÁTICA:\n{grammar}\n\n"
        f"CADENA DE PRUEBA: {tokens_str}\n\n"
        f"ERROR TÉCNICO DEVUELTO POR EL PARSER:\n{error_message}\n\n"
        "Explica este error específico al estudiante. En 2-3 párrafos: "
        "(1) qué significa el error en términos simples; "
        "(2) por qué ocurrió en SU gramática y SU cadena; "
        "(3) qué cambio concreto puede probar para resolverlo."
    )
    text, err = _call(prompt)
    if err:
        return {"ok": False, "error": err}
    return {"ok": True, "explanation": text, "model": _MODEL}


def recommend(
    *,
    parser_label: str,
    grammar: str,
    conflicts: list[str],
) -> dict[str, Any]:
    """Ask the LLM to suggest transformations for the user's grammar."""
    if conflicts:
        conflicts_block = "\n".join(f"  - {c}" for c in conflicts)
    else:
        conflicts_block = "(sin conflictos reportados — la gramática parece compatible)"

    prompt = (
        f"PARSER ELEGIDO:  {parser_label}\n\n"
        f"GRAMÁTICA DEL ESTUDIANTE:\n{grammar}\n\n"
        f"CONFLICTOS DETECTADOS:\n{conflicts_block}\n\n"
        "Recomienda transformaciones concretas sobre esta gramática para "
        "que funcione con el parser elegido. En 2-3 párrafos: "
        "(1) por qué la gramática actual genera esos conflictos; "
        "(2) qué técnica aplicar (eliminación de recursión izquierda, "
        "factorización izquierda, usar un parser más potente, etc.); "
        "(3) muestra la GRAMÁTICA REESCRITA línea por línea, lista "
        "para copiar y pegar. Usa la misma sintaxis (-> y |, eps para épsilon)."
    )
    text, err = _call(prompt)
    if err:
        return {"ok": False, "error": err}
    return {"ok": True, "recommendation": text, "model": _MODEL}
