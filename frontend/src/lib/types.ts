export type ParserKey = 'll1' | 'rd' | 'lr0' | 'slr1' | 'lr1' | 'lalr1'

export interface ParserConfig {
  key: ParserKey
  label: string
  type: 'top-down' | 'bottom-up'
  hasTable: boolean
  defaultGrammar: string
}

export interface LL1Step {
  stack: string[]
  input: string[]
  action: string
}

export interface LRTableRow {
  state: number
  action: Record<string, string>
  goto: Record<string, string | number>
}

export type LL1TableMap = Record<string, string>

export interface GrammarInfoData {
  ok: true
  start: string
  terminals: string[]
  non_terminals: string[]
  productions: Record<string, string[]>
}

export interface FirstFollowData {
  ok: true
  first: Record<string, string[]>
  follow: Record<string, string[]>
  output: string
}

export interface LL1TableData {
  ok: true
  table: LL1TableMap
  conflicts: string[]
  output: string
}

export interface LL1SimulateData {
  ok: true
  accepted: boolean
  steps: LL1Step[]
  conflicts: string[]
  output: string
}

export interface LRTableData {
  ok: true
  n_states: number
  table: LRTableRow[]
  conflicts: string[]
  states_output?: string
}

export interface TextSimulateData {
  ok: true
  accepted: boolean
  output: string
  conflicts: string[]
}

export interface DotData {
  ok: true
  dot: string
  n_states: number
}

export interface DerivationNodeData {
  name: string
  attributes?: {
    type?: 'nonterminal' | 'terminal' | 'epsilon' | 'operator'
    production?: string
    origin?: string
  }
  children?: DerivationNodeData[]
}

export interface TreeData {
  ok: true
  tree: DerivationNodeData | null
  ast: DerivationNodeData | null
  accepted: boolean
  error?: string
}

export interface ParseResult {
  grammarInfo?: GrammarInfoData
  firstFollow?: FirstFollowData
  ll1Table?: LL1TableData
  ll1Simulate?: LL1SimulateData
  lrTable?: LRTableData
  textSimulate?: TextSimulateData
  automatonDot?: string
  derivationTree?: TreeData
}
