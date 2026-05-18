"""
Derivation-tree construction for every parser in the lab.

We expose two builders:

* build_topdown_tree(grammar, table, tokens)
      — LL(1) and Recursive Descent. The tree grows from the start symbol
        downwards as each non-terminal is expanded.

* build_lr_tree(action, goto, tokens)
      — LR(0), SLR(1), LR(1), LALR(1). The tree is built bottom-up: every
        REDUCE pops |body| children off the stack and groups them under a
        fresh non-terminal node, which becomes the new top of the tree
        stack. The final tree on top after ACCEPT is the root.

The returned shape is exactly what `react-d3-tree` consumes:

    {
      "name": "E",
      "attributes": { "type": "nonterminal", "production": "E -> T E'" },
      "children": [ ... ]
    }
"""
from __future__ import annotations
from typing import Any
from api.grammar import Grammar, EPSILON, EOF


# ─────────────────────────────────────────── helpers

def _node(name: str, kind: str, *, production: str = '', children: list[dict] | None = None) -> dict[str, Any]:
    attributes: dict[str, str] = {'type': kind}
    if production:
        attributes['production'] = production
    node: dict[str, Any] = {'name': name, 'attributes': attributes}
    if children is not None:
        node['children'] = children
    return node


# ─────────────────────────────────────────── top-down (LL / RD)

def build_topdown_tree(
    grammar: Grammar,
    table: dict[tuple[str, str], list[str]],
    tokens: list[str],
) -> tuple[dict | None, bool, str]:
    """Build derivation tree using an LL(1)-style table.

    Returns (root, accepted, error_message).
    The tree is returned even on partial failure so the UI can show
    the prefix that was successfully expanded.
    """
    inp = tokens + [EOF]
    idx = 0

    # Each stack frame: (symbol_on_stack, tree_node_to_fill_or_None_for_EOF)
    root = _node(grammar.start, 'nonterminal', children=[])
    stack: list[tuple[str, dict | None]] = [(EOF, None), (grammar.start, root)]

    while stack:
        top_sym, top_node = stack[-1]
        curr = inp[idx] if idx < len(inp) else EOF

        if top_sym == EOF and curr == EOF:
            return root, True, ''

        if top_sym == EOF:
            return root, False, f"Stack empty but input remains: {inp[idx:]}"

        if top_sym == curr:
            stack.pop()
            idx += 1
            continue

        if top_sym in grammar.non_terminals:
            key = (top_sym, curr)
            if key not in table:
                return root, False, f"No table entry for ({top_sym}, '{curr}')"
            prod = table[key]
            stack.pop()
            assert top_node is not None
            children: list[dict] = []
            prod_str = ' '.join(prod) if prod != [EPSILON] else 'ε'
            top_node['attributes']['production'] = f"{top_sym} → {prod_str}"

            if prod == [EPSILON]:
                children.append(_node('ε', 'epsilon'))
            else:
                for sym in prod:
                    is_nt = sym in grammar.non_terminals
                    children.append(_node(
                        sym,
                        'nonterminal' if is_nt else 'terminal',
                        children=[] if is_nt else None,
                    ))
            top_node['children'] = children

            # Push children onto stack in reverse so leftmost is on top
            if prod != [EPSILON]:
                for sym, child in reversed(list(zip(prod, children))):
                    stack.append((sym, child))
            continue

        # terminal on top doesn't match current input
        return root, False, f"Terminal mismatch: expected '{top_sym}', got '{curr}'"

    return root, False, 'Stack exhausted unexpectedly'


# ─────────────────────────────────────────── bottom-up (LR family)

def build_lr_tree(
    action: dict[tuple[int, str], tuple],
    goto: dict[tuple[int, str], int],
    tokens: list[str],
) -> tuple[dict | None, bool, str]:
    """Build derivation tree by simulating the LR automaton.

    Each shift pushes a terminal-leaf onto a parallel tree stack.
    Each reduce pops |body| trees, wraps them under a new non-terminal
    node, and pushes that node. ACCEPT returns the only tree left.
    """
    inp = tokens + [EOF]
    state_stack: list[int] = [0]
    tree_stack:  list[dict] = []
    idx = 0

    while True:
        state = state_stack[-1]
        curr = inp[idx]
        entry = action.get((state, curr))

        if entry is None:
            partial = tree_stack[-1] if tree_stack else None
            return partial, False, f"No action for (state {state}, '{curr}')"

        if entry[0] == 'shift':
            _, next_state = entry
            state_stack.append(next_state)
            tree_stack.append(_node(curr, 'terminal'))
            idx += 1

        elif entry[0] == 'reduce':
            _, head, body = entry
            # Pop |body| frames
            children: list[dict] = []
            for _ in body:
                state_stack.pop()
                children.append(tree_stack.pop())
            children.reverse()   # leftmost first
            prod_str = ' '.join(body) if body else 'ε'
            if not body:
                children = [_node('ε', 'epsilon')]
            tree_stack.append(_node(
                head, 'nonterminal',
                production=f"{head} → {prod_str}",
                children=children,
            ))
            top_state = state_stack[-1]
            g = goto.get((top_state, head))
            if g is None:
                partial = tree_stack[-1] if tree_stack else None
                return partial, False, f"No goto for (state {top_state}, {head})"
            state_stack.append(g)

        elif entry[0] == 'accept':
            return (tree_stack[-1] if tree_stack else None), True, ''

        else:
            return None, False, f"Unknown action entry: {entry}"


# ─────────────────────────────────────────── AST simplification

def simplify_to_ast(node: dict | None) -> dict | None:
    """Return a simplified Abstract Syntax Tree from a parse tree.

    Heuristics applied bottom-up (universal, grammar-agnostic):

    1. ε nodes are dropped (do not appear in the AST).
    2. Single-child non-terminals are collapsed — the non-terminal
       is replaced by its only meaningful child. This kills the
       chains like  E → T → F → id  that come from operator-precedence
       grammars, leaving just  id.
    3. Binary-operator pattern detection: a non-terminal with exactly
       three children where the middle child is a terminal is promoted
       to that terminal as the root, with the outer children as
       operands. This turns  E → E + T  into  + [E, T]  — a real
       expression tree.
    4. Anything else keeps its non-terminal label but with the filtered
       children.

    The function is purely structural — no semantic information about
    the source grammar is used. That keeps it general enough to handle
    LL- and LR-style grammars without bespoke rules.
    """
    if node is None:
        return None

    kind = (node.get('attributes') or {}).get('type', '')
    name = node.get('name', '')

    # Rule 1: epsilon disappears
    if kind == 'epsilon':
        return None

    # Terminals are leaves of the AST
    if kind == 'terminal':
        return {
            'name': name,
            'attributes': {'type': 'terminal'},
        }

    # Non-terminal: recurse, drop None children
    children = [simplify_to_ast(c) for c in node.get('children', [])]
    children = [c for c in children if c is not None]

    if not children:
        return None

    # Rule 2: collapse single-child non-terminals
    if len(children) == 1:
        return children[0]

    # Rule 3: binary-operator pattern  [left, op, right]
    if (
        len(children) == 3
        and children[1].get('attributes', {}).get('type') == 'terminal'
    ):
        op = children[1]['name']
        return {
            'name': op,
            'attributes': {'type': 'operator', 'origin': name},
            'children': [children[0], children[2]],
        }

    # Rule 4: keep as non-terminal with filtered children
    return {
        'name': name,
        'attributes': {'type': 'nonterminal'},
        'children': children,
    }
