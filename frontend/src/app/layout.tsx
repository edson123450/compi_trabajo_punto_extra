import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Parser Lab — The Ultimate Parser App',
  description: 'Explorador interactivo de los 6 algoritmos clásicos de análisis sintáctico: LL(1), Descenso Recursivo, LR(0), SLR(1), LR(1) y LALR(1). Con autómatas, árboles de derivación, AST, asistente de errores y recomendaciones inteligentes.',
  applicationName: 'Parser Lab',
  manifest: '/manifest.webmanifest',
  icons: {
    icon:    [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple:   [{ url: '/icon.svg' }],
    shortcut: '/favicon.svg',
  },
  appleWebApp: {
    capable: true,
    title:   'Parser Lab',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width:      'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="flex h-screen overflow-hidden bg-gray-50 text-neutral-900 antialiased">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  )
}
