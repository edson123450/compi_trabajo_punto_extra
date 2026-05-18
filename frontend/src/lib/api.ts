const BASE = '/api'

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export const api = {
  grammarInfo:   (grammar: string)                   => post<any>('/grammar/info',   { grammar }),
  firstFollow:   (grammar: string)                   => post<any>('/first-follow',   { grammar }),
  ll1Table:      (grammar: string)                   => post<any>('/ll1/table',      { grammar }),
  ll1Simulate:   (grammar: string, tokens: string[]) => post<any>('/ll1/simulate',   { grammar, tokens }),
  ll1Tree:       (grammar: string, tokens: string[]) => post<any>('/ll1/tree',       { grammar, tokens }),
  rdSimulate:    (grammar: string, tokens: string[]) => post<any>('/rd/simulate',    { grammar, tokens }),
  rdTree:        (grammar: string, tokens: string[]) => post<any>('/rd/tree',        { grammar, tokens }),
  lr0Table:      (grammar: string)                   => post<any>('/lr0/table',      { grammar }),
  lr0Simulate:   (grammar: string, tokens: string[]) => post<any>('/lr0/simulate',   { grammar, tokens }),
  lr0Tree:       (grammar: string, tokens: string[]) => post<any>('/lr0/tree',       { grammar, tokens }),
  lr0Dot:        (grammar: string)                   => post<any>('/lr0/dot',        { grammar }),
  slr1Table:     (grammar: string)                   => post<any>('/slr1/table',     { grammar }),
  slr1Simulate:  (grammar: string, tokens: string[]) => post<any>('/slr1/simulate',  { grammar, tokens }),
  slr1Tree:      (grammar: string, tokens: string[]) => post<any>('/slr1/tree',      { grammar, tokens }),
  slr1Dot:       (grammar: string)                   => post<any>('/slr1/dot',       { grammar }),
  lr1Table:      (grammar: string)                   => post<any>('/lr1/table',      { grammar }),
  lr1Simulate:   (grammar: string, tokens: string[]) => post<any>('/lr1/simulate',   { grammar, tokens }),
  lr1Tree:       (grammar: string, tokens: string[]) => post<any>('/lr1/tree',       { grammar, tokens }),
  lr1Dot:        (grammar: string)                   => post<any>('/lr1/dot',        { grammar }),
  lalr1Table:    (grammar: string)                   => post<any>('/lalr1/table',    { grammar }),
  lalr1Simulate: (grammar: string, tokens: string[]) => post<any>('/lalr1/simulate', { grammar, tokens }),
  lalr1Tree:     (grammar: string, tokens: string[]) => post<any>('/lalr1/tree',     { grammar, tokens }),
  lalr1Dot:      (grammar: string)                   => post<any>('/lalr1/dot',      { grammar }),

  // ─── LLM-powered assistant ───
  aiExplainError: (params: {
    grammar:       string
    tokens:        string[]
    parser_label:  string
    error_message: string
  }) => post<any>('/ai/explain-error', params),

  aiRecommend: (params: {
    grammar:      string
    conflicts:    string[]
    parser_label: string
  }) => post<any>('/ai/recommend', params),
}
