'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, SkipBack, SkipForward, CheckCircle2, XCircle } from 'lucide-react'
import { StackVisualizer } from './StackVisualizer'
import type { LL1Step } from '@/lib/types'

function actionColor(action: string): string {
  if (action === 'ACCEPT')           return 'text-emerald-700'
  if (action.startsWith('ERROR'))    return 'text-red-600'
  if (action.startsWith('Derivar'))  return 'text-blue-700'
  if (action.startsWith('Match'))    return 'text-amber-700'
  return 'text-neutral-700'
}

function actionBg(action: string): string {
  if (action === 'ACCEPT')           return 'bg-emerald-50  border-emerald-200'
  if (action.startsWith('ERROR'))    return 'bg-red-50      border-red-200'
  if (action.startsWith('Derivar'))  return 'bg-blue-50     border-blue-200'
  if (action.startsWith('Match'))    return 'bg-amber-50    border-amber-200'
  return 'bg-neutral-50 border-neutral-200'
}

const NavBtn = ({ onClick, disabled, children }: {
  onClick: () => void; disabled: boolean; children: React.ReactNode
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
  >
    {children}
  </button>
)

interface Props {
  steps:    LL1Step[]
  accepted: boolean
}

export function SimulatorStepper({ steps, accepted }: Props) {
  const [idx, setIdx] = useState(0)

  if (!steps.length) return null

  const step    = steps[idx]
  const total   = steps.length
  const canPrev = idx > 0
  const canNext = idx < total - 1

  return (
    <div className="lab-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Simulador interactivo paso a paso
        </h3>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
            accepted
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50    border-red-200    text-red-700'
          }`}>
            {accepted ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
            {accepted ? 'Aceptado' : 'Rechazado'}
          </span>
          <span className="text-[11px] font-mono text-neutral-400 tabular-nums">{idx + 1}/{total}</span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 sm:gap-6">
        {/* Left: visual stack tower */}
        <div className="w-full sm:w-28">
          <StackVisualizer stack={step.stack} label="Pila" />
        </div>

        {/* Right: input + action + navigation */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Remaining input */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400 mb-2">
              Entrada restante
            </p>
            <div className="flex flex-wrap gap-1">
              {step.input.map((tok, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-mono transition-all duration-200 ${
                    i === 0
                      ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm scale-105 font-semibold'
                      : 'bg-neutral-100 border-neutral-200 text-neutral-500'
                  }`}
                >
                  {tok}
                </span>
              ))}
            </div>
          </div>

          {/* Action */}
          <div className={`rounded-xl border px-4 py-3 transition-all duration-200 ${actionBg(step.action)}`}>
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mr-2">
              Acción:
            </span>
            <span className={`text-sm font-mono font-semibold ${actionColor(step.action)}`}>
              {step.action}
            </span>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <NavBtn onClick={() => setIdx(0)}                                disabled={!canPrev}>
              <SkipBack    className="h-3.5 w-3.5" />
            </NavBtn>
            <NavBtn onClick={() => setIdx(i => Math.max(0, i - 1))}         disabled={!canPrev}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </NavBtn>
            <div className="flex-1 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-neutral-900 transition-all duration-200"
                style={{ width: `${((idx + 1) / total) * 100}%` }}
              />
            </div>
            <NavBtn onClick={() => setIdx(i => Math.min(total - 1, i + 1))} disabled={!canNext}>
              <ChevronRight className="h-3.5 w-3.5" />
            </NavBtn>
            <NavBtn onClick={() => setIdx(total - 1)}                        disabled={!canNext}>
              <SkipForward  className="h-3.5 w-3.5" />
            </NavBtn>
          </div>

          {/* All steps collapsible */}
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors duration-150 select-none">
              <ChevronRight className="h-3 w-3 transition-transform duration-200 group-open:rotate-90" />
              Ver todos los pasos ({total})
            </summary>
            <div className="mt-2 rounded-xl border border-neutral-200 overflow-hidden divide-y divide-neutral-100 max-h-44 overflow-y-auto">
              {steps.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`w-full flex items-start gap-2.5 px-3 py-1.5 text-xs font-mono text-left transition-colors duration-100 ${
                    i === idx
                      ? 'bg-neutral-100 text-neutral-900'
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
                  }`}
                >
                  <span className="text-neutral-400 w-5 text-right tabular-nums">{i + 1}</span>
                  <span className={actionColor(s.action)}>{s.action}</span>
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
