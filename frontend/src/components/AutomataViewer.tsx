'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, ZoomIn, ZoomOut, Maximize2, X, Minimize2 } from 'lucide-react'

interface Props {
  dot: string
  currentState?: number
  title?: string
}

// ── Shared: highlight the active state inside an SVG container ────────────────
function applyHighlight(el: HTMLDivElement | null, currentState: number | undefined) {
  if (!el) return
  el.querySelectorAll('.state-active').forEach(n => n.classList.remove('state-active'))
  if (currentState === undefined) return
  el.querySelectorAll<SVGGElement>('g[id^="node"]').forEach(g => {
    const textEl = g.querySelector('text')
    if (textEl && textEl.textContent?.trim().startsWith(`I${currentState}`)) {
      g.classList.add('state-active')
      g.querySelectorAll<SVGElement>('polygon, ellipse').forEach(shape => {
        shape.setAttribute('fill', '#dbeafe')
        shape.setAttribute('stroke', '#3b82f6')
        shape.setAttribute('stroke-width', '2')
      })
    }
  })
}

// ── Zoom controls ─────────────────────────────────────────────────────────────
function ZoomBar({
  scale, setScale, onMaximize,
}: { scale: number; setScale: React.Dispatch<React.SetStateAction<number>>; onMaximize: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setScale(s => Math.max(0.3, +(s - 0.2).toFixed(1)))}
        title="Reducir zoom"
        className="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-200 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 transition-colors duration-150"
      >
        <ZoomOut className="h-3 w-3" />
      </button>
      <span className="text-[10px] font-mono text-neutral-400 w-9 text-center tabular-nums">
        {Math.round(scale * 100)}%
      </span>
      <button
        onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))}
        title="Ampliar zoom"
        className="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-200 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 transition-colors duration-150"
      >
        <ZoomIn className="h-3 w-3" />
      </button>
      <div className="w-px h-4 bg-neutral-200 mx-0.5" />
      <button
        onClick={onMaximize}
        title="Ver en pantalla completa"
        className="flex h-6 w-6 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700 transition-colors duration-150"
      >
        <Maximize2 className="h-3 w-3" />
      </button>
    </div>
  )
}

// ── SVG canvas (shared between inline and modal) ──────────────────────────────
function SvgCanvas({
  svg, scale, loading, error, dot, containerRef,
}: {
  svg: string
  scale: number
  loading: boolean
  error: string | null
  dot: string
  containerRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <div className="relative w-full h-full overflow-auto dot-grid">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            Renderizando autómata…
          </div>
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center p-6 z-10">
          <div className="text-center">
            <p className="text-sm text-red-600 font-medium mb-1">Error al renderizar</p>
            <p className="text-xs text-neutral-500 font-mono max-w-xs">{error}</p>
          </div>
        </div>
      )}
      {!dot && !loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <p className="text-sm text-neutral-400 text-center max-w-xs">
            Ejecuta el parser para visualizar el autómata de estados aquí
          </p>
        </div>
      )}
      {svg && (
        <div
          ref={containerRef}
          className="automata-svg p-4 transition-transform duration-200 origin-top-left"
          style={{ transform: `scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  )
}

// ── Fullscreen modal ──────────────────────────────────────────────────────────
function AutomataModal({
  svg, dot, title, currentState, onClose,
}: {
  svg: string
  dot: string
  title: string
  currentState: number | undefined
  onClose: () => void
}) {
  const modalRef   = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  // Apply highlight inside the modal SVG copy
  useEffect(() => {
    applyHighlight(modalRef.current, currentState)
  }, [svg, currentState])

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={`Autómata ${title} — pantalla completa`}
    >
      <div className="relative flex flex-col rounded-2xl border border-white/10 bg-white shadow-2xl overflow-hidden"
        style={{ width: '92vw', height: '90vh' }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 bg-neutral-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Minimize2 className="h-3.5 w-3.5 text-neutral-400" />
            <span className="text-sm font-semibold text-neutral-700">{title}</span>
            {currentState !== undefined && (
              <span className="ml-2 rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-[10px] font-mono font-semibold text-blue-700">
                Estado activo: I{currentState}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <ZoomBar scale={scale} setScale={setScale} onMaximize={onClose} />
            <button
              onClick={onClose}
              title="Cerrar (Esc)"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-500 transition-colors duration-150"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal body — full space for the graph */}
        <div className="flex-1 overflow-hidden">
          <SvgCanvas
            svg={svg}
            scale={scale}
            loading={false}
            error={null}
            dot={dot}
            containerRef={modalRef}
          />
        </div>

        {/* ESC hint */}
        <div className="px-5 py-2 border-t border-neutral-100 bg-neutral-50/80 flex-shrink-0">
          <p className="text-[10px] text-neutral-400">
            Presiona <kbd className="rounded border border-neutral-300 bg-white px-1 py-0.5 font-mono text-[9px] shadow-sm">Esc</kbd> o haz clic fuera para cerrar
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function AutomataViewer({ dot, currentState, title = 'Autómata LR' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg,       setSvg]       = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [scale,     setScale]     = useState(1)
  const [modalOpen, setModalOpen] = useState(false)

  const openModal  = useCallback(() => setModalOpen(true),  [])
  const closeModal = useCallback(() => setModalOpen(false), [])

  // Render DOT → SVG via @hpcc-js/wasm
  useEffect(() => {
    if (!dot) { setSvg(''); return }
    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const mod = await import('@hpcc-js/wasm/graphviz') as any
        const GV  = mod.Graphviz ?? mod.default
        const gv  = await GV.load()
        const raw: string = gv.dot(dot)
        if (!cancelled) setSvg(raw)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error al renderizar el autómata')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [dot])

  // Highlight current state in the inline panel
  useEffect(() => {
    applyHighlight(containerRef.current, currentState)
  }, [svg, currentState])

  return (
    <>
      {/* ── Inline panel ── */}
      <div className="lab-card flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            {title}
          </h3>
          <ZoomBar scale={scale} setScale={setScale} onMaximize={openModal} />
        </div>

        {/* Canvas */}
        <div className="flex-1 min-h-[280px] sm:min-h-[360px] lg:min-h-[420px]">
          <SvgCanvas
            svg={svg}
            scale={scale}
            loading={loading}
            error={error}
            dot={dot}
            containerRef={containerRef}
          />
        </div>

        {/* Active-state footer */}
        {currentState !== undefined && (
          <div className="px-4 py-2 border-t border-neutral-100 bg-blue-50/50">
            <p className="text-[10px] text-blue-600 font-mono font-semibold">
              Estado activo: I{currentState}
            </p>
          </div>
        )}
      </div>

      {/* ── Fullscreen modal (portal) ── */}
      {modalOpen && (
        <AutomataModal
          svg={svg}
          dot={dot}
          title={title}
          currentState={currentState}
          onClose={closeModal}
        />
      )}
    </>
  )
}
