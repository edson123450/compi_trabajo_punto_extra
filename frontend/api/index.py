"""
The Ultimate Parser App – Flask API server para Vercel Serverless.
"""
from __future__ import annotations

import io
import os
import sys
import traceback
from contextlib import redirect_stdout
from typing import Any

# Garantiza que la raíz del proyecto esté en sys.path para que
# 'from api.xxx import ...' funcione correctamente en Vercel Serverless.
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from flask import Flask, jsonify, request, Response
from flask_cors import CORS

# ── local modules ────────────────────────────────────────────────────────────
from api.grammar import Grammar
from api.first_follow import compute_first, compute_follow, print_first_follow
from api.ll1_parser import build_ll1_table, print_ll1_table, simulate_ll1
from api.recursive_descent import RecursiveDescentParser
from api.lr_core import build_lr0_automaton, build_lr1_automaton, print_lr0_states, print_lr1_states
from api.lr_simulator import print_lr_table, simulate_lr
from api.lr0_parser import build_lr0_tables
from api.slr1_parser import build_slr1_tables
from api.lr1_parser import build_lr1_tables
from api.lalr1_parser import build_lalr1_tables
from api.derivation_trees import build_topdown_tree, build_lr_tree

# ── app setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app) # Permite que tu frontend de Next.js se conecte sin problemas de CORS


# ── helpers ───────────────────────────────────────────────────────────────────

def _capture(fn, *args, **kwargs) -> str:
    """Run *fn* and capture everything it prints to stdout."""
    buf = io.StringIO()
    with redirect_stdout(buf):
        fn(*args, **kwargs)
    return buf.getvalue()


def _parse_body() -> tuple[Grammar | None, list[str], Response | None]:
    """Extract and validate grammar + tokens from JSON body."""
    data = request.get_json(silent=True)
    if not data or "grammar" not in data:
        return None, [], _err("Missing 'grammar' field in request body")
    try:
        g = Grammar.parse(data["grammar"])
    except Exception as exc:
        return None, [], _err(f"Grammar parse error: {exc}")
    tokens: list[str] = data.get("tokens", [])
    return g, tokens, None


def _err(msg: str, code: int = 400) -> Response:
    return jsonify({"ok": False, "error": msg}), code  # type: ignore


def _ok(**payload) -> Response:
    return jsonify({"ok": True, **payload})


def _action_entry_to_str(entry) -> str:
    if entry is None:
        return ""
    if entry[0] == "shift":
        return f"s{entry[1]}"
    if entry[0] == "reduce":
        body = " ".join(entry[2]) if entry[2] else "eps"
        return f"r:{entry[1]}->{body}"
    if entry[0] == "accept":
        return "acc"
    return str(entry)


def _serialize_lr_tables(action, goto, n_states, terminals, nts):
    """Convert ACTION/GOTO dicts to JSON-serialisable structure."""
    terms = sorted(terminals) + ["$"]
    nts_s = sorted(nts)
    rows: list[dict] = []
    for s in range(n_states):
        row: dict[str, Any] = {"state": s, "action": {}, "goto": {}}
        for t in terms:
            e = action.get((s, t))
            row["action"][t] = _action_entry_to_str(e)
        for nt in nts_s:
            g = goto.get((s, nt))
            row["goto"][nt] = g if g is not None else ""
        rows.append(row)
    return rows


# ── routes ────────────────────────────────────────────────────────────────────

@app.route("/api/grammar/info", methods=["POST"])
def grammar_info():
    g, _, err = _parse_body()
    if err:
        return err
    return _ok(
        start=g.start,
        terminals=sorted(g.terminals),
        non_terminals=sorted(g.non_terminals),
        productions={
            head: [" ".join(b) for b in bodies]
            for head, bodies in g.productions.items()
        },
    )


@app.route("/api/first-follow", methods=["POST"])
def first_follow():
    g, _, err = _parse_body()
    if err:
        return err
    first = compute_first(g)
    follow = compute_follow(g, first)
    output = _capture(print_first_follow, first, follow)
    return _ok(
        first={nt: sorted(s) for nt, s in first.items()},
        follow={nt: sorted(s) for nt, s in follow.items()},
        output=output,
    )


# ── LL(1) ─────────────────────────────────────────────────────────────────────

@app.route("/api/ll1/table", methods=["POST"])
def ll1_table():
    g, _, err = _parse_body()
    if err:
        return err
    table, conflicts = build_ll1_table(g)
    output = _capture(print_ll1_table, g, table)
    table_dict = {
        f"{nt}|{t}": " ".join(prod)
        for (nt, t), prod in table.items()
    }
    return _ok(table=table_dict, conflicts=conflicts, output=output)


@app.route("/api/ll1/simulate", methods=["POST"])
def ll1_simulate():
    g, tokens, err = _parse_body()
    if err:
        return err
    if not tokens:
        return _err("Missing 'tokens' field")
    table, conflicts = build_ll1_table(g)
    steps: list[dict] = []

    from api.grammar import EOF, EPSILON

    inp = tokens + [EOF]
    stack = [EOF, g.start]
    idx = 0

    while stack:
        top = stack[-1]
        curr = inp[idx]
        stk_snap = list(reversed(stack))
        inp_snap = inp[idx:]

        if top == EOF and curr == EOF:
            steps.append({"stack": stk_snap, "input": inp_snap, "action": "ACCEPT"})
            break

        if top == EOF:
            steps.append({"stack": stk_snap, "input": inp_snap,
                          "action": "ERROR: stack exhausted"})
            break

        if top == curr:
            steps.append({"stack": stk_snap, "input": inp_snap,
                          "action": f"Match '{top}'"})
            stack.pop(); idx += 1

        elif top in g.non_terminals:
            key = (top, curr)
            if key not in table:
                steps.append({"stack": stk_snap, "input": inp_snap,
                               "action": f"ERROR: no entry ({top},{curr})"})
                break
            prod = table[key]
            steps.append({"stack": stk_snap, "input": inp_snap,
                          "action": f"Derivar {top} -> {' '.join(prod)}"})
            stack.pop()
            if prod != [EPSILON]:
                for s in reversed(prod):
                    stack.append(s)

        else:
            steps.append({"stack": stk_snap, "input": inp_snap,
                          "action": f"ERROR: mismatch '{top}' vs '{curr}'"})
            break

    accepted = bool(steps and steps[-1]["action"] == "ACCEPT")
    output = _capture(simulate_ll1, g, table, tokens)
    return _ok(accepted=accepted, steps=steps, conflicts=conflicts, output=output)


# ── Recursive Descent ─────────────────────────────────────────────────────────

@app.route("/api/rd/simulate", methods=["POST"])
def rd_simulate():
    g, tokens, err = _parse_body()
    if err:
        return err
    if not tokens:
        return _err("Missing 'tokens' field")
    rd = RecursiveDescentParser(g)
    output = _capture(rd.parse, tokens)
    accepted = "ACCEPT" in output
    return _ok(accepted=accepted, output=output, conflicts=rd.conflicts)


# ── LR(0) ─────────────────────────────────────────────────────────────────────

@app.route("/api/lr0/table", methods=["POST"])
def lr0_table():
    g, _, err = _parse_body()
    if err:
        return err
    action, goto, conflicts = build_lr0_tables(g)
    states, _ = build_lr0_automaton(g)
    n = len(states)
    rows = _serialize_lr_tables(action, goto, n, g.terminals, g.non_terminals)
    states_output = _capture(print_lr0_states, states)
    return _ok(n_states=n, table=rows, conflicts=conflicts, states_output=states_output)


@app.route("/api/lr0/simulate", methods=["POST"])
def lr0_simulate():
    g, tokens, err = _parse_body()
    if err:
        return err
    if not tokens:
        return _err("Missing 'tokens' field")
    action, goto, conflicts = build_lr0_tables(g)
    output = _capture(simulate_lr, action, goto, tokens, "LR(0)")
    accepted = "ACCEPT" in output
    return _ok(accepted=accepted, output=output, conflicts=conflicts)


# ── SLR(1) ────────────────────────────────────────────────────────────────────

@app.route("/api/slr1/table", methods=["POST"])
def slr1_table():
    g, _, err = _parse_body()
    if err:
        return err
    action, goto, conflicts = build_slr1_tables(g)
    states, _ = build_lr0_automaton(g)
    n = len(states)
    rows = _serialize_lr_tables(action, goto, n, g.terminals, g.non_terminals)
    return _ok(n_states=n, table=rows, conflicts=conflicts)


@app.route("/api/slr1/simulate", methods=["POST"])
def slr1_simulate():
    g, tokens, err = _parse_body()
    if err:
        return err
    if not tokens:
        return _err("Missing 'tokens' field")
    action, goto, conflicts = build_slr1_tables(g)
    output = _capture(simulate_lr, action, goto, tokens, "SLR(1)")
    accepted = "ACCEPT" in output
    return _ok(accepted=accepted, output=output, conflicts=conflicts)


# ── LR(1) ─────────────────────────────────────────────────────────────────────

@app.route("/api/lr1/table", methods=["POST"])
def lr1_table():
    g, _, err = _parse_body()
    if err:
        return err
    action, goto, conflicts = build_lr1_tables(g)
    states, _ = build_lr1_automaton(g)
    n = len(states)
    rows = _serialize_lr_tables(action, goto, n, g.terminals, g.non_terminals)
    states_output = _capture(print_lr1_states, states)
    return _ok(n_states=n, table=rows, conflicts=conflicts, states_output=states_output)


@app.route("/api/lr1/simulate", methods=["POST"])
def lr1_simulate():
    g, tokens, err = _parse_body()
    if err:
        return err
    if not tokens:
        return _err("Missing 'tokens' field")
    action, goto, conflicts = build_lr1_tables(g)
    output = _capture(simulate_lr, action, goto, tokens, "LR(1)")
    accepted = "ACCEPT" in output
    return _ok(accepted=accepted, output=output, conflicts=conflicts)


# ── LALR(1) ───────────────────────────────────────────────────────────────────

@app.route("/api/lalr1/table", methods=["POST"])
def lalr1_table():
    g, _, err = _parse_body()
    if err:
        return err
    action, goto, conflicts = build_lalr1_tables(g)
    lr1_states, _ = build_lr1_automaton(g)
    cores: set[frozenset] = {frozenset(item.core() for item in s) for s in lr1_states}
    n = len(cores)
    rows = _serialize_lr_tables(action, goto, n, g.terminals, g.non_terminals)
    return _ok(n_states=n, table=rows, conflicts=conflicts)


@app.route("/api/lalr1/simulate", methods=["POST"])
def lalr1_simulate():
    g, tokens, err = _parse_body()
    if err:
        return err
    if not tokens:
        return _err("Missing 'tokens' field")
    action, goto, conflicts = build_lalr1_tables(g)
    output = _capture(simulate_lr, action, goto, tokens, "LALR(1)")
    accepted = "ACCEPT" in output
    return _ok(accepted=accepted, output=output, conflicts=conflicts)


# ── Derivation Trees ──────────────────────────────────────────────────────────

@app.route("/api/ll1/tree", methods=["POST"])
def ll1_tree():
    g, tokens, err = _parse_body()
    if err:
        return err
    if not tokens:
        return _err("Missing 'tokens' field")
    table, _ = build_ll1_table(g)
    tree, accepted, error_msg = build_topdown_tree(g, table, tokens)
    return _ok(tree=tree, accepted=accepted, error=error_msg)


@app.route("/api/rd/tree", methods=["POST"])
def rd_tree():
    # Recursive descent uses the same LL(1) table, so the resulting tree
    # is identical to LL(1)'s. Endpoint kept separate for API clarity.
    g, tokens, err = _parse_body()
    if err:
        return err
    if not tokens:
        return _err("Missing 'tokens' field")
    table, _ = build_ll1_table(g)
    tree, accepted, error_msg = build_topdown_tree(g, table, tokens)
    return _ok(tree=tree, accepted=accepted, error=error_msg)


@app.route("/api/lr0/tree", methods=["POST"])
def lr0_tree():
    g, tokens, err = _parse_body()
    if err:
        return err
    if not tokens:
        return _err("Missing 'tokens' field")
    action, goto, _ = build_lr0_tables(g)
    tree, accepted, error_msg = build_lr_tree(action, goto, tokens)
    return _ok(tree=tree, accepted=accepted, error=error_msg)


@app.route("/api/slr1/tree", methods=["POST"])
def slr1_tree():
    g, tokens, err = _parse_body()
    if err:
        return err
    if not tokens:
        return _err("Missing 'tokens' field")
    action, goto, _ = build_slr1_tables(g)
    tree, accepted, error_msg = build_lr_tree(action, goto, tokens)
    return _ok(tree=tree, accepted=accepted, error=error_msg)


@app.route("/api/lr1/tree", methods=["POST"])
def lr1_tree():
    g, tokens, err = _parse_body()
    if err:
        return err
    if not tokens:
        return _err("Missing 'tokens' field")
    action, goto, _ = build_lr1_tables(g)
    tree, accepted, error_msg = build_lr_tree(action, goto, tokens)
    return _ok(tree=tree, accepted=accepted, error=error_msg)


@app.route("/api/lalr1/tree", methods=["POST"])
def lalr1_tree():
    g, tokens, err = _parse_body()
    if err:
        return err
    if not tokens:
        return _err("Missing 'tokens' field")
    action, goto, _ = build_lalr1_tables(g)
    tree, accepted, error_msg = build_lr_tree(action, goto, tokens)
    return _ok(tree=tree, accepted=accepted, error=error_msg)


# ── DOT / Automaton visualization ─────────────────────────────────────────────

def _dot_escape(s: str) -> str:
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')


def _generate_dot_lr0(states, transitions, name: str = "LR0") -> str:
    lines = [
        f'digraph {name.replace(" ", "_")} {{',
        '  rankdir=LR;',
        '  graph [bgcolor="transparent", pad="0.4", nodesep="0.5", ranksep="0.7"];',
        '  node [shape=rectangle, style="rounded,filled", fillcolor="#f0f7ff",',
        '        fontname="Courier New", fontsize=9, margin="0.2,0.12",',
        '        color="#93c5fd", penwidth=1.5];',
        '  edge [fontname="Courier New", fontsize=8, color="#64748b", arrowsize=0.7];',
        '',
    ]
    for i, state in enumerate(states):
        items = sorted(str(item) for item in state)
        parts = [f'I{i}'] + [_dot_escape(it) for it in items[:12]]
        if len(items) > 12:
            parts.append(f'(+{len(items) - 12} más)')
        label = '\\n'.join(parts)
        lines.append(f'  {i} [label="{label}"];')
    lines.append('')
    for (src, sym), dst in sorted(transitions.items()):
        lines.append(f'  {src} -> {dst} [label="{_dot_escape(sym)}"];')
    lines.append('}')
    return '\n'.join(lines)


def _generate_dot_lr1(states, transitions, name: str = "LR1") -> str:
    return _generate_dot_lr0(states, transitions, name)


@app.route("/api/lr0/dot", methods=["POST"])
def lr0_dot():
    g, _, err = _parse_body()
    if err:
        return err
    states, transitions = build_lr0_automaton(g)
    return _ok(dot=_generate_dot_lr0(states, transitions, "LR0"), n_states=len(states))


@app.route("/api/slr1/dot", methods=["POST"])
def slr1_dot():
    g, _, err = _parse_body()
    if err:
        return err
    states, transitions = build_lr0_automaton(g)
    return _ok(dot=_generate_dot_lr0(states, transitions, "SLR1"), n_states=len(states))


@app.route("/api/lr1/dot", methods=["POST"])
def lr1_dot():
    g, _, err = _parse_body()
    if err:
        return err
    states, transitions = build_lr1_automaton(g)
    return _ok(dot=_generate_dot_lr1(states, transitions, "LR1"), n_states=len(states))


@app.route("/api/lalr1/dot", methods=["POST"])
def lalr1_dot():
    g, _, err = _parse_body()
    if err:
        return err
    states, transitions = build_lr1_automaton(g)
    return _ok(dot=_generate_dot_lr1(states, transitions, "LALR1"), n_states=len(states))


# ── health & index ─────────────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return _ok(message="The Ultimate Parser App is running")


@app.route("/")
def index():
    endpoints = [rule.rule for rule in app.url_map.iter_rules()
                 if rule.rule.startswith("/api")]
    return _ok(endpoints=sorted(endpoints))


# ── error handlers ─────────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return _err(f"Endpoint not found: {request.path}", 404)


@app.errorhandler(500)
def server_error(e):
    return _err(f"Internal error: {traceback.format_exc()}", 500)


# ── entry point modificado para Vercel ─────────────────────────────────────────

# Quitamos el app.run() tradicional de abajo porque Vercel Serverless bloquea
# los hilos continuos. Vercel importará directamente este objeto "app".
if __name__ == "__main__":
    print("Running local development server")
    app.run(debug=True, port=5000)