'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Cpu, ChevronRight, Menu, X } from 'lucide-react'
import { TOP_DOWN_PARSERS, BOTTOM_UP_PARSERS, PARSERS } from '@/lib/parsers'

function NavGroup({ title, keys, onPick }: { title: string; keys: string[]; onPick?: () => void }) {
  const path = usePathname()
  return (
    <div className="mb-5">
      <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
        {title}
      </p>
      {keys.map(key => {
        const p      = PARSERS[key]
        const active = path === `/${key}`
        return (
          <Link
            key={key}
            href={`/${key}`}
            onClick={onPick}
            className={`flex items-center justify-between px-3 py-1.5 rounded-md text-sm mb-0.5 transition-colors duration-150 ${
              active
                ? 'bg-neutral-100 text-neutral-900 font-medium'
                : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
            }`}
          >
            {p.label}
            {active && <ChevronRight className="h-3 w-3 text-neutral-400" />}
          </Link>
        )
      })}
    </div>
  )
}

// ── Inner content (shared by desktop sidebar & mobile drawer) ─────────────────
function SidebarContent({ onPick }: { onPick?: () => void }) {
  return (
    <>
      <div className="px-3 mb-6 flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900">
          <Cpu className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-neutral-900 tracking-tight">Parser Lab</span>
      </div>

      <nav className="flex-1 px-2">
        <NavGroup title="Top-Down"  keys={TOP_DOWN_PARSERS}  onPick={onPick} />
        <div className="mx-3 border-t border-neutral-100" />
        <div className="mt-4">
          <NavGroup title="Bottom-Up" keys={BOTTOM_UP_PARSERS} onPick={onPick} />
        </div>
      </nav>

      <div className="px-3 mt-auto pt-4 border-t border-neutral-100">
        <p className="text-[10px] text-neutral-400">Flask API Serverless</p>
      </div>
    </>
  )
}

// ── Mobile drawer ─────────────────────────────────────────────────────────────
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Lock body scroll while open + ESC closes
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', h)
    }
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />
      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-200 shadow-xl flex flex-col py-4 transition-transform duration-200 ease-out md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de parsers"
      >
        <div className="flex items-center justify-between px-3 mb-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Menú
          </span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors duration-150"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SidebarContent onPick={onClose} />
      </aside>
    </>
  )
}

// ── Public component: desktop sidebar + mobile hamburger ──────────────────────
export function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile floating hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-30 flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white shadow-sm text-neutral-600 hover:bg-neutral-50 active:scale-95 transition-all duration-100 md:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile drawer */}
      <MobileDrawer open={open} onClose={() => setOpen(false)} />

      {/* Desktop sidebar (always visible from md up) */}
      <aside className="hidden md:flex w-52 flex-shrink-0 border-r border-neutral-200 bg-white flex-col py-4 shadow-sm">
        <SidebarContent />
      </aside>
    </>
  )
}
