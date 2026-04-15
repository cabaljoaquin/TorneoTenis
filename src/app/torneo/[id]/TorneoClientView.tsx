'use client'

import { AnimatePresence, motion } from 'framer-motion'
import CategoryTabs from '@/components/public/CategoryTabs'
import TournamentBracket from '@/components/public/TournamentBracket'
import { useParams, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { calculateStandings } from '@/utils/standingsCalculator'
import { Loader2, Activity, Calendar, Trophy, ChevronRight } from 'lucide-react'

// Utilidad para ordenar jerárquicamente las fases
const FASES_ORDER = ['32avos de Final', '16avos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final']

function buildBracket(partidos: any[], configLlave?: any[]): any[] {
  const eliminatorios = partidos.filter((p) => p.fase_bracket && p.fase_bracket !== 'Fase de Grupos')

  if (eliminatorios.length > 0) {
    // Hay partidos reales: mostrar nombres reales
    const roundsMap: Record<string, any[]> = {}
    eliminatorios.forEach((p) => {
      if (!roundsMap[p.fase_bracket]) roundsMap[p.fase_bracket] = []
      roundsMap[p.fase_bracket].push({
        id: p.id,
        bracket_index: p.bracket_index || 0,
        p1: p.p1?.nombre_mostrado || 'Esperando ganador...',
        p2: p.p2?.nombre_mostrado || 'Esperando ganador...',
        isP1Waiting: !p.p1,
        isP2Waiting: !p.p2,
        scoreStr: p.estado === 'finalizado' ? formatResultStr(p) : undefined,
        scoreList: p.estado === 'finalizado' ? formatResultArray(p) : [],
        p1Wins: p.estado === 'finalizado' && p.ganador_id === p.p1?.id,
        p2Wins: p.estado === 'finalizado' && p.ganador_id === p.p2?.id,
        finished: p.estado === 'finalizado',
        isPlaceholder: false,
      })
    })
    
    // Sort matches in each round by bracket_index automatically created during generation
    Object.keys(roundsMap).forEach(fase => {
      roundsMap[fase].sort((a, b) => a.bracket_index - b.bracket_index)
    })

    return Object.keys(roundsMap)
      .sort((a, b) => FASES_ORDER.indexOf(a) - FASES_ORDER.indexOf(b))
      .map((fase) => ({ title: fase, matches: roundsMap[fase] }))
  }

  // Sin partidos reales: mostrar bracket teórico desde configuracion_llave
  if (configLlave && configLlave.length > 0) {
    const roundsMap: Record<string, any[]> = {}
    configLlave.forEach((cfg) => {
      if (!roundsMap[cfg.fase]) roundsMap[cfg.fase] = []
      roundsMap[cfg.fase][cfg.match_index] = {
        id: `cfg-${cfg.id}`,
        p1: cfg.origen_p1,
        p2: cfg.origen_p2,
        isPlaceholder: true,
      }
    })
    return Object.keys(roundsMap)
      .sort((a, b) => FASES_ORDER.indexOf(a) - FASES_ORDER.indexOf(b))
      .map((fase) => ({ title: fase, matches: (roundsMap[fase] || []).filter(Boolean) }))
  }

  return []
}


// Utilidad para mostrar el score correctamente alineado P1 vs P2, 
// revirtiendo el string si el profe lo tipeó desde la perspectiva del ganador pero el ganador era P2
function formatResultStr(m: any) {
  if (!Array.isArray(m.resultado)) return 'Finalizado'
  
  let s1 = 0, s2 = 0
  m.resultado.forEach((set: any) => {
    if (set.p1 > set.p2) s1++
    else if (set.p2 > set.p1) s2++
  })
  
  const isBackwards = 
    (m.ganador_id === m.p2?.id && s1 > s2) ||
    (m.ganador_id === m.p1?.id && s2 > s1)

  return m.resultado.map((s:any) => {
     let tp1 = s.p1; let tp2 = s.p2;
     let tb1 = s.tb1; let tb2 = s.tb2;
     if (isBackwards) {
       tp1 = s.p2; tp2 = s.p1;
       tb1 = s.tb2; tb2 = s.tb1;
     }
     if (tb1 !== undefined) return `${tp1}-${tp2}(${tb1}-${tb2})`
     return `${tp1}-${tp2}`
  }).join(' / ')
}

function formatResultArray(m: any) {
  if (!Array.isArray(m.resultado)) return []
  
  let s1 = 0, s2 = 0
  m.resultado.forEach((set: any) => {
    if (set.p1 > set.p2) s1++
    else if (set.p2 > set.p1) s2++
  })
  
  const isBackwards = 
    (m.ganador_id === m.p2?.id && s1 > s2) ||
    (m.ganador_id === m.p1?.id && s2 > s1)

  return m.resultado.map((s:any) => {
     let tp1 = s.p1; let tp2 = s.p2;
     let tb1 = s.tb1; let tb2 = s.tb2;
     if (isBackwards) {
       tp1 = s.p2; tp2 = s.p1;
       tb1 = s.tb2; tb2 = s.tb1;
     }
     return { s1: tp1, s2: tp2, tb1, tb2 }
  })
}

function TorneoContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const torneoId = params.id as string
  const [categories, setCategories] = useState<{id: string, name: string}[]>([])
  
  // Datos dinamicos
  const [zonas, setZonas] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [recentMatches, setRecentMatches] = useState<any[]>([])
  const [configLlave, setConfigLlave] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const currentCatId = searchParams.get('cat') || categories[0]?.id
  const [fase, setFase] = useState<'zonas'|'eliminatorias'|'campeones'>('zonas')

  useEffect(() => {
    async function loadConfig() {
      // Obtenemos listado de categorías activas con inscripciones de este torneo
      const { data: dCat } = await supabase.from('categorias').select('id, nombre').order('nombre')
      if (dCat) setCategories(dCat.map(d => ({ id: d.id, name: d.nombre })))
        
      // Ultimos 5 finalizados de todo el torneo para el ticker top
      const { data: rMatches } = await supabase
        .from('partidos')
        .select(`
          id, resultado, ganador_id,
          p1:participantes!participante_1_id(id, nombre_mostrado),
          p2:participantes!participante_2_id(id, nombre_mostrado),
          categorias(nombre)
        `)
        .eq('torneo_id', torneoId)
        .eq('estado', 'finalizado')
        .not('resultado', 'is', null)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(5)
      
      if (rMatches) setRecentMatches(rMatches)
    }
    loadConfig()
  }, [torneoId])

  useEffect(() => {
    if (!currentCatId) return
    async function loadCategoryData() {
      setLoading(true)
      
      const { data: zs } = await supabase
        .from('zonas')
        .select(`
          id, nombre,
          participantes_zonas ( participante_id, participantes(id, nombre_mostrado) )
        `)
        .eq('torneo_id', torneoId)
        .eq('categoria_id', currentCatId)
        .order('nombre')
        
      const { data: ms } = await supabase
        .from('partidos')
        .select(`
          id, estado, resultado, zona_id, fase_bracket, bracket_index, fecha_hora, ganador_id, categoria_id,
          p1:participantes!participante_1_id(id, nombre_mostrado),
          p2:participantes!participante_2_id(id, nombre_mostrado)
        `)
        .eq('torneo_id', torneoId)

      const { data: cfgLlave } = await supabase
        .from('configuracion_llave')
        .select('*')
        .eq('torneo_id', torneoId)
        .eq('categoria_id', currentCatId)
        .order('fase')
        .order('match_index')
      
      const validZoneIds = zs ? zs.map(z => z.id) : []
      const filteredMs = (ms || []).filter(m => {
        return m.categoria_id === currentCatId || validZoneIds.includes(m.zona_id) || (!m.categoria_id && !m.zona_id)
      })

      if (zs) setZonas(zs)
      if (filteredMs) setMatches(filteredMs)
      setConfigLlave(cfgLlave || [])
      
      setLoading(false)
    }
    loadCategoryData()
  }, [currentCatId, torneoId])

  const roundData = buildBracket(matches, configLlave)
  const zonaMatchesLookup = matches.filter(m => m.zona_id && (!m.fase_bracket || m.fase_bracket === 'Fase de Grupos'))

  if (categories.length === 0) {
    return <div className="h-40 flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> Cargando torneo...</div>
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      
      {/* TICKER DE ULTIMOS RESULTADOS */}
      {recentMatches.length > 0 && (
        <div className="mb-6 px-4">
          <div className="bg-surface-card border border-surface-border rounded-xl p-3 flex flex-col gap-3 overflow-hidden shadow-lg shadow-black/20">
            <div className="flex items-center gap-2 text-brand-400 font-bold text-xs uppercase tracking-widest px-2">
               <Activity size={14} className="animate-pulse" />
               Últimos Resultados
            </div>
            <div className="flex overflow-x-auto custom-scrollbar w-full pb-2 px-2">
              {recentMatches.map((m, idx) => {
                const sets = formatResultArray(m)
                const isP1Winner = m.ganador_id === m.p1?.id
                const isP2Winner = m.ganador_id === m.p2?.id
                return (
                  <div key={m.id} className="flex shrink-0">
                    <div className="flex flex-col min-w-fit px-4 py-1 justify-center">
                      <div className="grid grid-cols-[140px_auto] sm:grid-cols-[170px_auto] gap-x-4 gap-y-1.5 items-center">
                        <div className={`text-sm truncate ${isP1Winner ? 'text-brand-300 font-bold' : 'text-slate-500'}`} title={m.p1?.nombre_mostrado}>
                          {m.p1?.nombre_mostrado} {isP1Winner && '🏆'}
                        </div>
                        <div className={`flex gap-2.5 font-mono text-sm ${isP1Winner ? 'text-brand-300 font-bold' : 'text-slate-500'}`}>
                          {sets.map((s: any, i: number) => <span key={i} className="w-5 text-center flex-shrink-0">{s.s1}{s.tb1 !== undefined ? <sup className="text-[9px] ml-0.5">{s.tb1}</sup> : ''}</span>)}
                        </div>
                        
                        <div className={`text-sm truncate ${isP2Winner ? 'text-brand-300 font-bold' : 'text-slate-500'}`} title={m.p2?.nombre_mostrado}>
                          {m.p2?.nombre_mostrado} {isP2Winner && '🏆'}
                        </div>
                        <div className={`flex gap-2.5 font-mono text-sm ${isP2Winner ? 'text-brand-300 font-bold' : 'text-slate-500'}`}>
                          {sets.map((s: any, i: number) => <span key={i} className="w-5 text-center flex-shrink-0">{s.s2}{s.tb2 !== undefined ? <sup className="text-[9px] ml-0.5">{s.tb2}</sup> : ''}</span>)}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-600 font-semibold mt-2">{m.categorias?.nombre}</span>
                    </div>
                    {idx < recentMatches.length - 1 && (
                      <div className="w-px self-stretch my-2 mx-1 bg-gradient-to-b from-transparent via-surface-border to-transparent" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <CategoryTabs categories={categories} />

      <div className="flex justify-center gap-4 mt-6 mb-2">
        <button onClick={() => setFase('zonas')} className={`text-xs font-semibold uppercase tracking-wider pb-2 border-b-2 transition-colors ${fase === 'zonas' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Fase de Grupos</button>
        <button onClick={() => setFase('eliminatorias')} className={`text-xs font-semibold uppercase tracking-wider pb-2 border-b-2 transition-colors ${fase === 'eliminatorias' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Eliminatorias</button>
      </div>
      
      <div className="mt-6 px-4 min-h-[400px]">
        {loading ? (
           <div className="h-40 flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /></div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCatId + fase}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="w-full flex justify-center"
            >
              
              {/* VISTA DE ELIMINATORIAS */}
              {fase === 'eliminatorias' && (
                roundData.length > 0
                  ? (
                    <div className="w-full">
                      {configLlave.length > 0 && !matches.some(m => m.fase_bracket && m.fase_bracket !== 'Fase de Grupos') && (
                        <div className="flex items-center gap-2 mb-4 px-1 text-xs text-amber-500/80">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/30 border border-amber-500/50" />
                          Los cruces son preliminares. Los nombres reales se asignarán al finalizar todas las zonas.
                        </div>
                      )}
                      <TournamentBracket rounds={roundData} />
                    </div>
                  )
                  : <div className="text-slate-500 mt-10">Todavía no hay llaves configuradas para esta categoría.</div>
              )}

              {/* VISTA DE ZONAS */}
              {fase === 'zonas' && (
                zonas.length > 0 ? (
                  <div className="w-full grid md:grid-cols-2 gap-8">
                    {zonas.map(z => {
                      const zMatches = zonaMatchesLookup.filter(m => m.zona_id === z.id)
                      const standings = calculateStandings(z.participantes_zonas || [], zMatches)
                      
                      return (
                        <div key={z.id} className="bg-surface-card border border-surface-border rounded-xl shadow-lg overflow-hidden flex flex-col">
                          <div className="bg-slate-900/40 px-5 py-3 border-b border-surface-border flex justify-between items-center">
                            <h3 className="font-bold text-brand-400 text-lg">{z.nombre}</h3>
                          </div>
                          
                          {/* TABLA DE POSICIONES */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                              <thead className="text-[10px] uppercase text-slate-500 bg-surface/30">
                                <tr>
                                  <th className="px-4 py-2 font-semibold">Jugador</th>
                                  <th className="px-2 py-2 font-semibold text-center" title="Partidos Jugados">PJ</th>
                                  <th className="px-2 py-2 font-semibold text-center text-green-400/70" title="Partidos Ganados">PG</th>
                                  <th className="px-2 py-2 font-semibold text-center text-red-400/70" title="Partidos Perdidos">PP</th>
                                  <th className="px-2 py-2 font-semibold text-center" title="Diferencia de Sets">DS</th>
                                  <th className="px-4 py-2 font-bold text-center text-brand-400">Pts</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-surface-border/50">
                                {standings.map((row, i) => (
                                  <tr key={row.id} className="hover:bg-surface-hover/30 transition-colors">
                                    <td className="px-4 py-2.5 font-medium text-slate-200">
                                      {i===0 && <span className="w-1.5 h-1.5 inline-block bg-brand-500 rounded-full mr-2" title="Líder actual"></span>}
                                      {row.nombre}
                                    </td>
                                    <td className="px-2 py-2.5 text-center text-slate-400">{row.pj}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-400">{row.pg}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-400">{row.pp}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-400">{row.ds > 0 ? '+'+row.ds : row.ds}</td>
                                    <td className="px-4 py-2.5 text-center font-bold text-brand-300 bg-brand-500/5">{row.puntos}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* PARTIDOS DE LA ZONA */}
                          {zMatches.length > 0 && (
                            <div className="bg-surface/50 p-4 border-t border-surface-border flex-1">
                              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-3 flex items-center gap-1.5">
                                <Calendar size={12} /> Fixture
                              </p>
                              <div className="space-y-2">
                                {zMatches.map(m => (
                                  <div key={m.id} className="text-xs bg-surface-card border border-surface-border border-l-2 border-l-brand-600 rounded p-2.5 flex justify-between items-center shadow-sm">
                                    <div className="flex flex-col gap-0.5">
                                      <span className={m.ganador_id === m.p1?.id ? 'font-bold text-brand-300' : 'text-slate-300'}>
                                        {m.p1?.nombre_mostrado} {m.ganador_id === m.p1?.id && '🏆'}
                                      </span>
                                      <span className={m.ganador_id === m.p2?.id ? 'font-bold text-brand-300' : 'text-slate-300'}>
                                        {m.p2?.nombre_mostrado} {m.ganador_id === m.p2?.id && '🏆'}
                                      </span>
                                    </div>
                                    
                                    <div className="text-right pl-3 shrink-0">
                                      {m.estado === 'finalizado' ? (
                                        <span className="font-mono text-[11px] bg-surface px-1.5 py-0.5 border border-surface-border rounded text-slate-300">
                                          {formatResultStr(m)}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] uppercase font-bold text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">Pendiente</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : <div className="text-slate-500 mt-10">Ninguna zona configurada.</div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

export default function TorneoClientView() {
  return (
    <Suspense fallback={<div className="h-40 flex items-center justify-center animate-pulse text-slate-500">Cargando escenario...</div>}>
      <TorneoContent />
    </Suspense>
  )
}
