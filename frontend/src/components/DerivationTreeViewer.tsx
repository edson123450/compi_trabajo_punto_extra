'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createPortal } from 'react-dom'
import {
  Network, Loader2, ZoomIn, ZoomOut, Maximize2, X, Minimize2,
  CheckCircle2, XCircle, Info, GitBranch, Sigma,
} from 'lucide-react'

// react-d3-tree depends on the DOM (d3, ResizeObserver), so we lazy-load
// it client-side only. Next.js would otherwise fail with SSR errors.
const Tree = dynamic(() => import('react-d3-tree').then(m => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        Cargando librería de árboles…
      </div>
    </div>
  ),
})

// ─────────────────────────────────────────── types

export interface DerivationNode {
  name: string
  attributes?: {
    type?: 'nonterminal' | 'terminal' | 'epsilon' | 'operator'
    production?: string
    origin?: string
  }
  children?: DerivationNode[]
}

type ViewMode = 'parse' | 'ast'

interface Props {
  tree:     DerivationNode | null
  ast:      DerivationNode | null
  accepted: boolean
  error?:   string
  title?:   string
}

// ─────────────────────────────────────────── visuals

const NODE_FILL: Record<string, string> = {
  nonterminal: '#dbeafe',   // blue-100
  terminal:    '#fef3c7',   // amber-100
  epsilon:     '#f3e8ff',   // violet-100
  operator:    '#d1fae5',   // emerald-100
}
const NODE_STROKE: Record<string, string> = {
  nonterminal: '#3b82f6',   // blue-500
  terminal:    '#d97706',   // amber-600
  epsilon:     '#a855f7',   // violet-500
  operator:    '#10b981',   // emerald-500
}
const NODE_TEXT: Record<string, string> = {
  nonterminal: '#1e40af',
  terminal:    '#92400e',
  epsilon:     '#6b21a8',
  operator:    '#065f46',
}

function renderCustomNode({ nodeDatum }: any) {
  const kind     = nodeDatum.attributes?.type ?? 'nonterminal'
  const isEps    = kind === 'epsilon'
  const isTerm   = kind === 'terminal'
  const isOp     = kind === 'operator'
  const isLeaf   = !nodeDatum.children || nodeDatum.children.length === 0

  // Geometry adapts to label width
  const label    = isEps ? 'ε' : nodeDatum.name
  const padding  = isOp ? 16 : 14
  const charW    = 7
  const width    = Math.max(isOp ? 42 : 36, label.length * charW + padding * 2)
  const height   = isOp ? 34 : 30
  const rx       = isTerm || isEps ? 14 : isOp ? 17 : 6

  return (
    <g>
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={rx}
        ry={rx}
        fill={NODE_FILL[kind]}
        stroke={NODE_STROKE[kind]}
        strokeWidth={1.5}
      />
      <text
        textAnchor="middle"
        dy="0.32em"
        style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: isOp ? '13px' : '12px',
          fontWeight: isOp ? 700 : (isLeaf ? 600 : 500),
          fill: NODE_TEXT[kind],
          stroke: 'none',
        }}
      >
        {label}
      </text>
    </g>
  )
}

// ─────────────────────────────────────────── tree helpers

function countNodes(node: DerivationNode | null): number {
  if (!node) return 0
  let n = 1
  if (node.children) for (const c of node.children) n += countNodes(c)
  return n
}

function treeDepth(node: DerivationNode | null): number {
  if (!node) return 0
  if (!node.children?.length) return 1
  return 1 + Math.max(...node.children.map(treeDepth))
}

// ─────────────────────────────────────────── canvas wrapper

function TreeCanvas({
  tree, zoom, translate, onTranslate,
}: {
  tree: DerivationNode
  zoom: number
  translate: { x: number; y: number }
  onTranslate: (t: { x: number; y: number }) => void
}) {
  return (
    <Tree
      data={tree as any}
      orientation="vertical"
      pathFunc="step"
      collapsible={true}
      renderCustomNodeElement={renderCustomNode}
      separation={{ siblings: 1.2, nonSiblings: 1.5 }}
      nodeSize={{ x: 90, y: 70 }}
      zoom={zoom}
      translate={translate}
      onUpdate={(s: any) => onTranslate(s.translate)}
      pathClassFunc={() => 'derivation-tree-link'}
    />
  )
}

// ─────────────────────────────────────────── zoom bar

function ZoomBar({
  zoom, setZoom, onMaximize,
}: { zoom: number; setZoom: React.Dispatch<React.SetStateAction<number>>; onMaximize?: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setZoom(z => Math.max(0.2, +(z - 0.15).toFixed(2)))}
        title="Reducir zoom"
        className="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-200 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 transition-colors duration-150"
      >
        <ZoomOut className="h-3 w-3" />
      </button>
      <span className="text-[10px] font-mono text-neutral-400 w-9 text-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => setZoom(z => Math.min(3, +(z + 0.15).toFixed(2)))}
        title="Ampliar zoom"
        className="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-200 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 transition-colors duration-150"
      >
        <ZoomIn className="h-3 w-3" />
      </button>
      {onMaximize && (
        <>
          <div className="w-px h-4 bg-neutral-200 mx-0.5" />
          <button
            onClick={onMaximize}
            title="Pantalla completa"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700 transition-colors duration-150"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────── modal (fullscreen)

// ─────────────────────────────────────────── view toggle

function ViewToggle({
  mode, setMode, hasAst,
}: { mode: ViewMode; setMode: (m: ViewMode) => void; hasAst: boolean }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
      <button
        onClick={() => setMode('parse')}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 ${
          mode === 'parse'
            ? 'bg-white text-blue-700 shadow-sm'
            : 'text-neutral-400 hover:text-neutral-600'
        }`}
        title="Árbol de derivación fiel a la gramática"
      >
        <GitBranch className="h-3 w-3" />
        Parse Tree
      </button>
      <button
        onClick={() => setMode('ast')}
        disabled={!hasAst}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 ${
          mode === 'ast'
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-neutral-400 hover:text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed'
        }`}
        title="Árbol semántico simplificado (sin nodos auxiliares ni ε)"
      >
        <Sigma className="h-3 w-3" />
        AST
      </button>
    </div>
  )
}


// ─────────────────────────────────────────── modal (fullscreen)

function TreeModal({
  tree, ast, accepted, title, initialMode, onClose,
}: {
  tree: DerivationNode | null
  ast: DerivationNode | null
  accepted: boolean
  title: string
  initialMode: ViewMode
  onClose: () => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom]           = useState(1)
  const [translate, setTranslate] = useState({ x: 400, y: 60 })
  const [mode, setMode]           = useState<ViewMode>(initialMode)

  const displayTree = mode === 'ast' ? ast : tree

  // Recenter on mount based on wrapper size
  useEffect(() => {
    if (!wrapperRef.current) return
    const w = wrapperRef.current.clientWidth
    setTranslate({ x: w / 2, y: 60 })
  }, [mode])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

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
    >
      <div className="relative flex flex-col rounded-2xl border border-white/10 bg-white shadow-2xl overflow-hidden"
        style={{ width: '92vw', height: '90vh' }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 bg-neutral-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Minimize2 className="h-3.5 w-3.5 text-neutral-400" />
            <span className="text-sm font-semibold text-neutral-700">{title}</span>
            <span className={`ml-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
              accepted
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50    border-red-200    text-red-700'
            }`}>
              {accepted ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
              {accepted ? 'Aceptado' : 'Rechazado'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ViewToggle mode={mode} setMode={setMode} hasAst={!!ast} />
            <ZoomBar zoom={zoom} setZoom={setZoom} />
            <button
              onClick={onClose}
              title="Cerrar (Esc)"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-500 transition-colors duration-150"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={wrapperRef} className="flex-1 dot-grid">
          {displayTree && (
            <TreeCanvas tree={displayTree} zoom={zoom} translate={translate} onTranslate={setTranslate} />
          )}
        </div>

        <div className="px-5 py-2 border-t border-neutral-100 bg-neutral-50/80 flex-shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-neutral-400">
            Click en un nodo para colapsar/expandir · Arrastra para mover · <kbd className="rounded border border-neutral-300 bg-white px-1 py-0.5 font-mono text-[9px] shadow-sm">Esc</kbd> para cerrar
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─────────────────────────────────────────── main component

export function DerivationTreeViewer({
  tree, ast, accepted, error, title = 'Árbol de derivación',
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom]           = useState(0.85)
  const [translate, setTranslate] = useState({ x: 240, y: 40 })
  const [modal, setModal]         = useState(false)
  const [mode, setMode]           = useState<ViewMode>('parse')

  const displayTree = mode === 'ast' ? ast : tree
  const hasAst      = !!ast

  // Recenter on mount/resize/mode-change
  useEffect(() => {
    if (!wrapperRef.current) return
    const apply = () => {
      const w = wrapperRef.current?.clientWidth ?? 480
      setTranslate(prev => ({ x: w / 2, y: prev.y }))
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [mode])

  const stats = displayTree
    ? { nodes: countNodes(displayTree), depth: treeDepth(displayTree) }
    : null

  return (
    <div className="lab-card overflow-hidden flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-neutral-100">
        <div className="flex items-center gap-2 flex-wrap">
          <Network className="h-3.5 w-3.5 text-neutral-400" />
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            {title}
          </h3>
          {stats && (
            <span className="text-[10px] font-mono text-neutral-400 ml-1">
              {stats.nodes} nodos · profundidad {stats.depth}
            </span>
          )}
          {tree && (
            <span className={`ml-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              accepted
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50    border-red-200    text-red-700'
            }`}>
              {accepted ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
              {accepted ? 'Aceptado' : 'Rechazado'}
            </span>
          )}
        </div>
        {tree && (
          <div className="flex items-center gap-2">
            <ViewToggle mode={mode} setMode={setMode} hasAst={hasAst} />
            <ZoomBar zoom={zoom} setZoom={setZoom} onMaximize={() => setModal(true)} />
          </div>
        )}
      </div>

      <div ref={wrapperRef} className="flex-1 min-h-[420px] sm:min-h-[520px] lg:min-h-[620px] dot-grid relative overflow-hidden">
        {!tree && !error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center max-w-xs">
              <Network className="h-6 w-6 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">
                Ejecuta el parser para visualizar el árbol de derivación
              </p>
            </div>
          </div>
        )}
        {error && !tree && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center max-w-xs">
              <XCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-600 font-medium mb-1">No se pudo construir el árbol</p>
              <p className="text-xs text-neutral-500 font-mono leading-relaxed">{error}</p>
            </div>
          </div>
        )}
        {displayTree && (
          <TreeCanvas tree={displayTree} zoom={zoom} translate={translate} onTranslate={setTranslate} />
        )}
      </div>

      {tree && (
        <div className="px-4 py-2 border-t border-neutral-100 bg-neutral-50/60 flex items-center gap-3">
          <Info className="h-3 w-3 text-neutral-400 flex-shrink-0" />
          <p className="text-[10px] text-neutral-500 leading-snug flex-1">
            {mode === 'parse' ? (
              <>
                <span className="inline-flex items-center gap-1 mr-2">
                  <span className="inline-block h-2 w-2 rounded-sm bg-blue-100 border border-blue-400" />
                  no-terminal
                </span>
                <span className="inline-flex items-center gap-1 mr-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-100 border border-amber-500" />
                  terminal
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-violet-100 border border-violet-500" />
                  ε
                </span>
                <span className="ml-2 text-neutral-400">— fiel a la gramática</span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 mr-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-100 border border-emerald-500" />
                  operador
                </span>
                <span className="inline-flex items-center gap-1 mr-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-100 border border-amber-500" />
                  operando
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-blue-100 border border-blue-400" />
                  no-terminal
                </span>
                <span className="ml-2 text-neutral-400">— sin ε ni unarios</span>
              </>
            )}
          </p>
        </div>
      )}

      {modal && tree && (
        <TreeModal tree={tree} ast={ast} accepted={accepted} title={title}
          initialMode={mode} onClose={() => setModal(false)} />
      )}
    </div>
  )
}
