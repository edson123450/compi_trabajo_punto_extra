'use client'

import { useState, useCallback } from 'react'
import { analyzeError } from '@/lib/errorAnalysis'
import { api } from '@/lib/api'
import { Bot, AlertCircle, Lightbulb, X, Sparkles, Loader2 } from 'lucide-react'

interface Props {
  error:        string
  parserKey:    string
  parserLabel?: string
  grammar?:     string
  tokens?:      string[]
  onDismiss?:   () => void
}

export function ErrorAssistant({
  error, parserKey, parserLabel, grammar, tokens, onDismiss,
}: Props) {
  const a = analyzeError(error, parserKey)

  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [aiError,       setAiError]       = useState<string | null>(null)
  const [aiLoading,     setAiLoading]     = useState(false)
  const [aiModel,       setAiModel]       = useState<string | null>(null)

  const canAskAi = !!grammar && grammar.trim().length > 0

  const askAi = useCallback(async () => {
    if (!grammar) return
    setAiLoading(true)
    setAiError(null)
    setAiExplanation(null)
    try {
      const res = await api.aiExplainError({
        grammar,
        tokens:        tokens ?? [],
        parser_label:  parserLabel ?? parserKey.toUpperCase(),
        error_message: error,
      })
      if (res.ok) {
        setAiExplanation(res.explanation)
        setAiModel(res.model ?? null)
      } else {
        setAiError(res.error ?? 'No fue posible contactar al asistente IA.')
      }
    } catch (e: any) {
      setAiError(e?.message ?? 'Error de red al contactar al asistente IA.')
    } finally {
      setAiLoading(false)
    }
  }, [grammar, tokens, parserLabel, parserKey, error])

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden shadow-sm">
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-red-100/70 border-b border-red-200">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
            <Bot className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-red-800">Asistente de errores sintácticos</span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-300 hover:text-red-600 transition-colors duration-150"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Heuristic explanation (instant, no API) */}
        <div className="flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800 mb-0.5">{a.title}</p>
            <p className="text-sm text-red-700 leading-relaxed">{a.explanation}</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-white/60 px-3 py-2.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-neutral-700 leading-relaxed">{a.hint}</p>
        </div>

        {/* AI-powered explanation (on demand) */}
        {canAskAi && !aiExplanation && !aiLoading && !aiError && (
          <button
            onClick={askAi}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-violet-300 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:from-violet-100 hover:to-fuchsia-100 hover:border-violet-400 active:scale-[0.99] transition-all duration-150 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Pedir explicación detallada a la IA
          </button>
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

        {aiExplanation && (
          <div className="rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-white overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-violet-100/50 border-b border-violet-200">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-violet-600" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                  Explicación IA
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
              <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap">
                {aiExplanation}
              </p>
            </div>
          </div>
        )}

        {/* Raw error (collapsed) */}
        <details className="group">
          <summary className="cursor-pointer list-none text-[10px] text-red-400 hover:text-red-600 transition-colors duration-150 select-none">
            Ver detalle técnico ↓
          </summary>
          <pre className="mt-1.5 overflow-x-auto rounded-md border border-red-200 bg-white/60 px-2.5 py-1.5 text-[10px] font-mono text-red-600 leading-relaxed">
            {error}
          </pre>
        </details>
      </div>
    </div>
  )
}
