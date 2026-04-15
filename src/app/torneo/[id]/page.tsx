import type { Metadata } from 'next'
import TorneoClientView from './TorneoClientView'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: 'Llaves del Torneo',
  description: 'Sigue los partidos y clasificaciones en tiempo real.',
}

export default async function TorneoPublicPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  
  const supabase = await createClient()
  const { data: torneo } = await supabase
    .from('torneos')
    .select('nombre, sedes(nombre)')
    .eq('id', params.id)
    .single()

  return (
    <main className="min-h-screen bg-surface flex flex-col">
      <header className="py-6 px-6 border-b border-surface-border bg-surface-card text-center sticky top-0 z-50">
        <h1 className="text-xl font-bold text-white tracking-widest uppercase">
          {torneo?.nombre || 'Torneo'}
        </h1>
        <p className="text-xs text-slate-400 mt-1">Sede: {(torneo?.sedes as any)?.nombre || 'General'}</p>
      </header>

      <div className="flex-1 overflow-x-hidden">
        <TorneoClientView />
      </div>
    </main>
  )
}
