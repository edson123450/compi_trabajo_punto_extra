'use client'

import { useState, useCallback } from 'react'
import { analyzeRecommendations, type Recommendation } from '@/lib/recommendations'
import { api } from '@/lib/api'
import { PARSERS } from '@/lib/parsers'
import {
  Sparkles, AlertTriangle, Info, Wrench, XCircle, Loader2, AlertCircle,
} from 'lucide-react'

interface Props {
  grammar: string
  conflicts: string[]
  parserKey: string
}

const SEVERITY_STYLES = {
  info: {
    wrap:  'border-blue-200 bg-blue-50',
    icon:  'text-blue-500',
    title: 'text-blue-800',
    body:  'text-blue-700',
    hint:  'border-blue-200 bg-white/70 text-neutral-700',
  },
  warning: {
    wrap:  'border-amber-200 bg-amber-50',
    icon:  'text-amber-500',
    title: 'text-amber-800',
    body:  'text-amber-700',
    hint:  'border-amber-200 bg-white/70 text-neutral-700',
  },
  error: {
    wrap:  'border-red-200 bg-red-50',
    icon:  'text-red-500',
    title: 'text-red-800',
    body:  'text-red-700',
    hint:  'border-red-200 bg-white/70 text-neutral-700',
  },
}

function RecCard({ rec }: { rec: Recommendation }) {
  const s    = SEVERITY_STYLES[rec.severity]
  const Icon = rec.severity === 'error' ? XCircle : rec.severity === 'warning' ? AlertTriangle : Info

  return (
    <div className={`rounded-lg border p-3 ${s.wrap}`}>
      <div className="flex items-start gap-2.5">
        <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${s.icon}`} />
        <div className="min-w-0 space-y-1.5">
          <p className={`text-sm font-semibold ${s.title}`}>{rec.title}</p>
          <p className={`text-xs leading-relaxed ${s.body}`}>{rec.description}</p>
          {rec.example && (
            <div className={`mt-2 rounded-md border px-3 py-2 ${s.hint}`}>
              <div className="flex items-center gap-1 mb-1">
                <Wrench className="h-3 w-3 text-neutral-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                  Sugerencia
                </span>
              </div>
              <pre className="text-[10px] font-mono leading-relaxed whitespace-pre-wrap">{rec.example}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function SmartRecommendations({ grammar, conflicts, parserKey }: Props) {
  const recs = analyzeRecommendations(grammar, conflicts, parserKey)

  const [aiText,    setAiText]    = useState<string | null>(null)
  const [aiError,   setAiError]   = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiModel,   setAiModel]   = useState<string | null>(null)

  const askAi = useCallback(async () => {
    if (!grammar.trim()) return
    setAiLoading(true)
    setAiError(null)
    setAiText(null)
    try {
      const res = await api.aiRecommend({
        grammar,
        conflicts,
        parser_label: PARSERS[parserKey]?.label ?? parserKey.toUpperCase(),
      })
      if (res.ok) {
        setAiText(res.recommendation)
        setAiModel(res.model ?? null)
      } else {
        setAiError(res.error ?? 'No fue posible contactar al asistente IA.')
      }
    } catch (e: any) {
      setAiError(e?.message ?? 'Error de red al contactar al asistente IA.')
    } finally {
      setAiLoading(false)
    }
  }, [grammar, conflicts, parserKey])

  if (!recs.length && !aiText && !aiLoading && !aiError) {
    // Nothing to show locally — still offer the AI button if grammar exists
    if (!grammar.trim()) return null
    return (
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Recomendaciones inteligentes
          </h3>
        </div>
        <p className="text-xs text-neutral-500 mb-3">
          No detectamos problemas obvios en tu gramática. ¿Quieres una segunda opinión de la IA?
        </p>
        <AiButton onClick={askAi} disabled={aiLoading} />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          Recomendaciones inteligentes
        </h3>
        {recs.length > 0 && (
          <span className="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
            {recs.length}
          </span>
        )}
      </div>

      <div className="space-y-2 mb-3">
        {recs.map((rec, i) => <RecCard key={i} rec={rec} />)}
      </div>

      {/* AI section */}
      {!aiText && !aiLoading && !aiError && (
        <AiButton onClick={askAi} disabled={aiLoading} />
      )}

      {aiLoading && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-3">
          <Loader2 className="h-3.5 w-3.5 text-violet-500 animate-spin" />
          <span className="text-xs text-violet-700">Consultando a la IA…</span>
        </div>
      )}

      {aiError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-amber-800 mb-0.5">No se pudo consultar a la IA</p>
              <p className="text-[11px] text-amber-700 leading-relaxed">{aiError}</p>
              <button
                onClick={() => { setAiError(null); askAi() }}
                className="mt-1.5 text-[10px] font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {aiText && (
        <div className="rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-white overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-violet-100/50 border-b border-violet-200">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-violet-600" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                Sugerencia IA
              </span>
              {aiModel && (
                <span className="text-[9px] text-violet-400 font-mono">· {aiModel}</span>
              )}
            </div>
            <button
              onClick={askAi}
              className="text-[10px] text-violet-500 hover:text-violet-700 underline underline-offset-2"
            >
              Regenerar
            </button>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap font-mono">
              {aiText}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function AiButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-violet-300 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:from-violet-100 hover:to-fuchsia-100 hover:border-violet-400 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] transition-all duration-150 shadow-sm"
    >
      <Sparkles className="h-3.5 w-3.5" />
      Pedir transformación a la IA
    </button>
  )
}
