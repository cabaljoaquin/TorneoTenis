import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s | TorneoTenis',
    default:  'TorneoTenis — Seguí tu torneo en vivo',
  },
  description: 'Plataforma de gestión y seguimiento de torneos de tenis amateur.',
  keywords:    ['tenis', 'torneo', 'resultados', 'llaves', 'grupos'],
  openGraph: {
    title: 'TorneoTenis — Seguí tu torneo en vivo',
    description: 'Encontrá toda la información de los torneos: llaves, grupos, resultados en tiempo real y horarios.',
    url: 'https://mitorneotenis.vercel.app',
    siteName: 'TorneoTenis',
    locale: 'es_AR',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  )
}
