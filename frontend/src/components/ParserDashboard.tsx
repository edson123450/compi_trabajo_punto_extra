'use client'

import { useState, useCallback, useEffect } from 'react'
import { PARSERS }              from '@/lib/parsers'
import { api }                  from '@/lib/api'
import { pushHistory }          from '@/lib/history'
import { GrammarPanel }         from './GrammarPanel'
import { FirstFollowPanel }     from './FirstFollowPanel'
import { LL1TableView }         from './LL1TableView'
import { ActionGotoTable }      from './ActionGotoTable'
import { SimulatorStepper }     from './SimulatorStepper'
import { DerivationTrace }      from './DerivationTrace'
import { RawOutputView }        from './RawOutputView'
import { ErrorAssistant }       from './ErrorAssistant'
import { SmartRecommendations } from './SmartRecommendations'
import { HistoryExport }        from './HistoryExport'
import { AutomataViewer }       from './AutomataViewer'
import { ComparativePanel }     from './ComparativePanel'
import { DerivationTreeViewer } from './DerivationTreeViewer'
import type { ParseResult }     from '@/lib/types'
import type { GrammarExample }  from '@/lib/grammarZoo'

const TREE_API: Record<string, (g: string, t: string[]) => Promise<any>> = {
  ll1:   api.ll1Tree,
  rd:    api.rdTree,
  lr0:   api.lr0Tree,
  slr1:  api.slr1Tree,
  lr1:   api.lr1Tree,
  lalr1: api.lalr1Tree,
}

const LR_TABLE_API: Record<string, (g: string) => Promise<any>> = {
  lr0: api.lr0Table, slr1: api.slr1Table, lr1: api.lr1Table, lalr1: api.lalr1Table,
}
const LR_SIM_API: Record<string, (g: string, t: string[]) => Promise<any>> = {
  lr0: api.lr0Simulate, slr1: api.slr1Simulate, lr1: api.lr1Simulate, lalr1: api.lalr1Simulate,
}
const LR_DOT_API: Record<string, (g: string) => Promise<any>> = {
  lr0: api.lr0Dot, slr1: api.slr1Dot, lr1: api.lr1Dot, lalr1: api.lalr1Dot,
}

function getConflicts(r: ParseResult | null): string[] {
  if (!r) return []
  return r.ll1Table?.conflicts ?? r.lrTable?.conflicts ?? r.textSimulate?.conflicts ?? []
}

// Extract current LR state from simulation output (first step's stack top)
function extractCurrentLRState(output: string): number | undefined {
  const lines = output.split('\n')
  const dataLines = lines.filter(l => /^\d+\s+/.test(l.trim()))
  if (!dataLines.length) return undefined
  // Last processed step: take its stack (first number after step)
  const last = dataLines[dataLines.length - 1].trim()
  const parts = last.split(/\s{2,}/)
  if (parts.length >= 2) {
    const stackTokens = parts[1].trim().split(/\s+/)
    const top = parseInt(stackTokens[stackTokens.length - 1])
    return isNaN(top) ? undefined : top
  }
  return undefined
}

export function ParserDashboard({ parserKey }: { parserKey: string }) {
  const config = PARSERS[parserKey]

  const [grammar,  setGrammar]  = useState(config?.defaultGrammar ?? '')
  const [tokenStr, setTokenStr] = useState('id + id * id')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<ParseResult | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    setResult(null); setError(null)
    if (config) setGrammar(config.defaultGrammar)
  }, [parserKey]) // eslint-disable-line

  const run = useCallback(async () => {
    if (!config) return
    setLoading(true); setError(null); setResult(null)
    const tokens = tokenStr.trim().split(/\s+/).filter(Boolean)

    try {
      let res: ParseResult = {}
      let accepted: boolean | null = null

      const treeApi = TREE_API[parserKey]

      if (parserKey === 'll1') {
        const [gi, ff, tbl, sim, tree] = await Promise.all([
          api.grammarInfo(grammar), api.firstFollow(grammar),
          api.ll1Table(grammar),
          tokens.length ? api.ll1Simulate(grammar, tokens) : Promise.resolve(null),
          tokens.length ? treeApi(grammar, tokens) : Promise.resolve(null),
        ])
        if (!gi.ok)  throw new Error(gi.error)
        if (!ff.ok)  throw new Error(ff.error)
        if (!tbl.ok) throw new Error(tbl.error)
        if (sim && !sim.ok) throw new Error(sim.error)
        res = {
          grammarInfo: gi, firstFollow: ff,
          ll1Table: tbl, ll1Simulate: sim ?? undefined,
          derivationTree: tree?.ok ? tree : undefined,
        }
        accepted = sim?.accepted ?? null

      } else if (parserKey === 'rd') {
        if (!tokens.length) {
          setError('Ingresa una cadena de prueba para ejecutar el Descenso Recursivo.')
          setLoading(false); return
        }
        const [sim, tree] = await Promise.all([
          api.rdSimulate(grammar, tokens),
          treeApi(grammar, tokens),
        ])
        if (!sim.ok) throw new Error(sim.error)
        res = {
          textSimulate: sim,
          derivationTree: tree?.ok ? tree : undefined,
        }
        accepted = sim.accepted

      } else {
        const dotApi   = LR_DOT_API[parserKey]
        const tableApi = LR_TABLE_API[parserKey]
        const simApi   = LR_SIM_API[parserKey]
        const [dot, tbl, sim, tree] = await Promise.all([
          dotApi(grammar),
          tableApi(grammar),
          tokens.length ? simApi(grammar, tokens) : Promise.resolve(null),
          tokens.length ? treeApi(grammar, tokens) : Promise.resolve(null),
        ])
        if (!tbl.ok) throw new Error(tbl.error)
        if (sim && !sim.ok) throw new Error(sim.error)
        res = {
          lrTable: tbl,
          textSimulate: sim ?? undefined,
          automatonDot: dot?.ok ? dot.dot : undefined,
          derivationTree: tree?.ok ? tree : undefined,
        }
        accepted = sim?.accepted ?? null
      }

      setResult(res)
      pushHistory({ parserKey, grammar, tokens: tokenStr.trim(), accepted })

    } catch (e: any) {
      const msg = e?.message ?? 'Error desconocido'
      setError(msg)
      pushHistory({ parserKey, grammar, tokens: tokenStr.trim(), accepted: null })
    } finally {
      setLoading(false)
    }
  }, [grammar, tokenStr, parserKey, config])

  const handleLoad = useCallback((g: string, t: string) => {
    setGrammar(g); setTokenStr(t); setResult(null); setError(null)
  }, [])

  const handleLoadExample = useCallback((ex: GrammarExample) => {
    setGrammar(ex.grammar)
    setTokenStr(ex.validTokens)
    setResult(null)
    setError(null)
  }, [])

  if (!config) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400 text-sm">
        Parser &quot;{parserKey}&quot; no encontrado.
      </div>
    )
  }

  const conflicts    = getConflicts(result)
  const hasConflicts = conflicts.length > 0
  const currentLRState = result?.textSimulate?.output
    ? extractCurrentLRState(result.textSimulate.output)
    : undefined
  const isLR = !['ll1', 'rd'].includes(parserKey)

  return (
    <div className="min-h-full dot-grid p-4 md:p-6 pt-14 md:pt-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-neutral-900 tracking-tight">
              {config.label}
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              {config.type === 'top-down' ? 'Descendente (Top-Down)' : 'Ascendente (Bottom-Up)'} · Interactive Visual Arena
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
            config.type === 'top-down'
              ? 'bg-violet-50 border-violet-200 text-violet-700'
              : 'bg-blue-50   border-blue-200   text-blue-700'
          }`}>
            {config.type === 'top-down' ? 'Top-Down' : 'Bottom-Up'}
          </span>
        </div>

        {/* ── Main arena: inputs left + automaton right ── */}
        <div className={`grid gap-5 ${isLR ? 'grid-cols-1 lg:grid-cols-[2fr_3fr]' : 'grid-cols-1'}`}>
          {/* Left column: controls */}
          <div className="space-y-4">
            <GrammarPanel
              grammar={grammar}
              tokens={tokenStr}
              loading={loading}
              parserKey={parserKey}
              onGrammarChange={setGrammar}
              onTokensChange={setTokenStr}
              onSubmit={run}
              onLoadExample={handleLoadExample}
            />
            <HistoryExport
              grammar={grammar}
              tokens={tokenStr}
              parserKey={parserKey}
              result={result}
              onLoad={handleLoad}
            />
          </div>

          {/* Right column: automaton (LR parsers only) */}
          {isLR && (
            <AutomataViewer
              dot={result?.automatonDot ?? ''}
              currentState={currentLRState}
              title={`Autómata ${config.label}`}
            />
          )}
        </div>

        {/* ── Error assistant ── */}
        {error && (
          <ErrorAssistant
            error={error}
            parserKey={parserKey}
            parserLabel={config.label}
            grammar={grammar}
            tokens={tokenStr.trim().split(/\s+/).filter(Boolean)}
            onDismiss={() => setError(null)}
          />
        )}

        {/* ── Comparative analysis + smart recommendations ── */}
        {(result !== null || error !== null) && (
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
            <ComparativePanel
              parserKey={parserKey}
              conflicts={conflicts}
              hasConflicts={hasConflicts}
            />
            <SmartRecommendations
              grammar={grammar}
              conflicts={conflicts}
              parserKey={parserKey}
            />
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div className="space-y-5">

            {/* FIRST/FOLLOW + LL(1) table */}
            {result.firstFollow && <FirstFollowPanel data={result.firstFollow} />}
            {result.ll1Table && result.grammarInfo && (
              <LL1TableView data={result.ll1Table} grammarInfo={result.grammarInfo} />
            )}

            {/* LL(1) step simulator + derivation trace */}
            {result.ll1Simulate && (
              <div className="grid gap-5 grid-cols-1 lg:grid-cols-[3fr_2fr]">
                <SimulatorStepper
                  steps={result.ll1Simulate.steps}
                  accepted={result.ll1Simulate.accepted}
                />
                <DerivationTrace steps={result.ll1Simulate.steps} />
              </div>
            )}

            {/* LR ACTION/GOTO table */}
            {result.lrTable && <ActionGotoTable data={result.lrTable} />}

            {/* LR / RD text output */}
            {result.textSimulate && (
              <RawOutputView
                output={result.textSimulate.output}
                accepted={result.textSimulate.accepted}
                title={parserKey === 'rd' ? 'Traza — Descenso Recursivo' : `Traza — ${config.label}`}
              />
            )}

            {/* Derivation tree + AST (LL / RD / LR family) */}
            {result.derivationTree && (
              <DerivationTreeViewer
                tree={result.derivationTree.tree}
                ast={result.derivationTree.ast}
                accepted={result.derivationTree.accepted}
                error={result.derivationTree.error}
                title={`Árbol · ${config.label}`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
