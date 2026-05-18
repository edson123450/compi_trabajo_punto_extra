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

# Model + budget configuration. gpt-4o is ~13x more expensive than
# gpt-4o-mini per call but dramatically more reliable on formal-logic
# tasks (parser theory, grammar transformations). For an exposition
# demo with a handful of calls, the total cost is still cents.
_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o')
_MAX_OUTPUT_TOKENS = 700
_TIMEOUT_SECONDS   = 25     # well under Vercel's 30s function limit


_SYSTEM_PROMPT = (
    "Eres un profesor universitario de Compiladores. Hablas en español, "
    "claro y directo. Tu trabajo es ayudar a un estudiante a entender lo "
    "que pasó con su parser. Responde con un máximo de 3 párrafos cortos. "
    "Nunca uses markdown (ni asteriscos, ni hashtags). Usa frases breves. "
    "Sé didáctico pero conciso — el estudiante ya tiene el contexto "
    "técnico, no necesita teoría general, necesita entender SU caso.\n\n"
    "REGLA CRÍTICA — anti-alucinación:\n"
    "Antes de afirmar que una gramática tiene un problema, VERIFICA el "
    "hecho contra la gramática que te dieron. En particular:\n"
    "  * 'Recursión izquierda directa' SOLO existe si hay una producción "
    "    de la forma X -> X ... (el primer símbolo del cuerpo es el mismo "
    "    no-terminal del lado izquierdo). Si NO existe esa forma, NO "
    "    digas que tiene recursión izquierda.\n"
    "  * 'Gramática ambigua' SOLO se puede afirmar si una cadena tiene "
    "    múltiples árboles de derivación, o si el parser reportó conflictos "
    "    explícitos en la tabla. NO digas 'ambigua' sólo porque hay un "
    "    no-terminal que se redefine.\n"
    "  * Si te dicen 'no hay conflictos en la tabla', la gramática "
    "    funciona con ese parser tal como está. NO inventes problemas para "
    "    justificar una transformación.\n"
    "  * Una producción como  R -> L  donde L deriva a otra cosa es una "
    "    simple sustitución, NO una 'dependencia cíclica'.\n"
    "Si verdaderamente no hay problemas, dilo claramente — el estudiante "
    "agradece la confirmación. Inventar problemas es peor que no decir nada."
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
        "(2) por qué ocurrió en SU gramática y SU cadena CONCRETA (no "
        "    generalizes ni inventes problemas; usa lo que ves arriba); "
        "(3) qué cambio concreto puede probar para resolverlo. \n\n"
        "Recuerda: solo afirma 'recursión izquierda' si ves una "
        "producción X -> X ... en la gramática; solo afirma 'ambigüedad' "
        "si el error específicamente menciona conflictos; no recetes "
        "transformaciones genéricas sin que apliquen a este caso."
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
    """Ask the LLM to suggest transformations for the user's grammar.

    The prompt is deliberately structured so the model can answer
    "everything is fine, no changes needed" — this is the correct
    response for grammars that already work with the selected parser
    (e.g. the Dragon Book's LR(1)-not-SLR(1) example).
    """
    if conflicts:
        conflicts_block = (
            "Conflictos REPORTADOS por la tabla del parser:\n"
            + "\n".join(f"  - {c}" for c in conflicts)
        )
        directive = (
            "Como SÍ hay conflictos reportados, explica al estudiante "
            "qué transformación aplicar para resolverlos. En 2-3 párrafos: "
            "(1) por qué esos conflictos específicos surgen en SU gramática "
            "con ESTE parser; "
            "(2) qué técnica concreta aplica (eliminación de recursión "
            "izquierda, factorización izquierda, subir a un parser más "
            "potente, etc.); "
            "(3) muestra la GRAMÁTICA REESCRITA línea por línea, lista "
            "para copiar y pegar (sintaxis: '->' y '|', 'eps' para épsilon)."
        )
    else:
        conflicts_block = (
            "La tabla del parser NO reportó ningún conflicto. Esto significa "
            "que la gramática es compatible con este parser tal como está."
        )
        directive = (
            "Como NO hay conflictos, la gramática ya funciona con este parser. "
            "Tu respuesta debe ser breve y honesta: "
            "(1) confirma en una o dos oraciones que la gramática ya es "
            "compatible con el parser elegido; "
            "(2) opcionalmente, en otra oración corta, menciona una "
            "característica notable de la gramática (por ejemplo: 'es el "
            "ejemplo clásico del Dragon Book para mostrar que LR(1) > SLR(1)' "
            "si reconoces el caso, o 'es la forma factorizada estándar de "
            "expresiones aritméticas', etc.). \n"
            "NO inventes problemas. NO recomiendes transformaciones. NO "
            "afirmes que tiene recursión izquierda si no la tiene "
            "(busca producciones de la forma X -> X ..., y SOLO si las "
            "encuentras). NO afirmes que es ambigua sin evidencia."
        )

    prompt = (
        f"PARSER ELEGIDO:  {parser_label}\n\n"
        f"GRAMÁTICA DEL ESTUDIANTE:\n{grammar}\n\n"
        f"{conflicts_block}\n\n"
        f"{directive}"
    )
    text, err = _call(prompt)
    if err:
        return {"ok": False, "error": err}
    return {"ok": True, "recommendation": text, "model": _MODEL}
