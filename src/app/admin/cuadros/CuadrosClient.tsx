'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Users, Loader2, Calendar, AlertCircle, Zap, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface Props {
  userId: string
}

export default function CuadrosWorkspace({ userId }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  
  const [torneos, setTorneos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [torneoActivo, setTorneoActivo] = useState<string>('')
  const [categoriaActiva, setCategoriaActiva] = useState<string>('')

  const [inscripciones, setInscripciones] = useState<any[]>([])
  const [zonas, setZonas] = useState<any[]>([])
  const [participantesZonificados, setParticipantesZonificados] = useState<any[]>([])
  const [partidosZona, setPartidosZona] = useState<any[]>([])

  const [nuevaZonaName, setNuevaZonaName] = useState('')
  const [sedes, setSedes] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [zonaScheduling, setZonaScheduling] = useState<{zona: any, jugadores: any[]} | null>(null)
  const [matchForm, setMatchForm] = useState({ id: '', p1: '', p2: '', fechaHora: '', sedeId: '', fase: 'Fase de Grupos' })
  const [isSavingMatch, setIsSavingMatch] = useState(false)
  const [playoffsGenerados, setPlayoffsGenerados] = useState(false)
  const [isGeneratingCruces, setIsGeneratingCruces] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    async function init() {
      // Solo torneos de este admin
      const { data: ts } = await supabase
        .from('torneos')
        .select('*')
        .eq('estado', 'En curso')
        .eq('admin_id', userId)

      if (ts && ts.length > 0) {
        setTorneos(ts)
        setTorneoActivo(ts[0].id)
      } else {
        setTorneos([])
        setLoading(false)
      }

      const { data: cs } = await supabase.from('categorias').select('*')
      if (cs && cs.length > 0) {
        setCategorias(cs)
        setCategoriaActiva(cs[0].id)
      }
      
      const { data: sds } = await supabase.from('sedes').select('*')
      if (sds) setSedes(sds)
    }
    init()
  }, [userId])

  useEffect(() => {
    if (torneoActivo && categoriaActiva) loadWorkspace(torneoActivo, categoriaActiva)
  }, [torneoActivo, categoriaActiva])

  const loadWorkspace = async (tId: string, cId: string, showLoader = true) => {
    if (showLoader) setLoading(true)
    
    const { data: ins } = await supabase
      .from('inscripciones')
      .select('id, participante_id, participantes(id, nombre_mostrado, nombre, apellido)')
      .eq('torneo_id', tId)
      .eq('categoria_id', cId)

    const { data: zs } = await supabase
      .from('zonas')
      .select('*')
      .eq('torneo_id', tId)
      .eq('categoria_id', cId)
      .order('created_at', { ascending: true })

    const zoneIds = zs ? zs.map(z => z.id) : []
    let pZonasData: any[] = []
    if (zoneIds.length > 0) {
      const { data: pz } = await supabase.from('participantes_zonas').select('*').in('zona_id', zoneIds)
      pZonasData = pz || []
    }

    let pZonasPartidos: any[] = []
    if (zoneIds.length > 0) {
      const { data: pt } = await supabase
        .from('partidos')
        .select(`id, zona_id, fecha_hora, fase_bracket, sede_id, estado, participante_1_id, participante_2_id,
          p1:participantes!participante_1_id(nombre_mostrado),
          p2:participantes!participante_2_id(nombre_mostrado)
        `)
        .in('zona_id', zoneIds)
      pZonasPartidos = pt || []
    }

    const { count: countPlayoffs } = await supabase
      .from('partidos')
      .select('id', { count: 'exact', head: true })
      .eq('torneo_id', tId)
      .eq('categoria_id', cId)
      .not('fase_bracket', 'is', null)
      .neq('fase_bracket', 'Fase de Grupos')

    setInscripciones(ins || [])
    setZonas(zs || [])
    setParticipantesZonificados(pZonasData)
    setPartidosZona(pZonasPartidos)
    setPlayoffsGenerados((countPlayoffs ?? 0) > 0)
    setLoading(false)
  }

  const assignedSet = new Set(participantesZonificados.map(p => p.participante_id))
  const jugadoresSueltos = inscripciones.filter(ins => !assignedSet.has(ins.participante_id))

  const handleCreateZona = async () => {
    if (!nuevaZonaName.trim()) return
    const { data } = await supabase
      .from('zonas')
      .insert({ nombre: nuevaZonaName, torneo_id: torneoActivo, categoria_id: categoriaActiva })
      .select('*').single()
    if (data) { setZonas([...zonas, data]); setNuevaZonaName('') }
  }

  const handleAssignToZone = async (zonaId: string, participante: any) => {
    const pId = participante.participantes.id
    // Optimistic: move player immediately from available to zone
    const tempId = 'temp-' + Date.now()
    setParticipantesZonificados(prev => [...prev, { id: tempId, zona_id: zonaId, participante_id: pId }])

    const { data, error } = await supabase
      .from('participantes_zonas')
      .insert({ zona_id: zonaId, participante_id: pId })
      .select('*')
      .single()

    if (error) {
      alert('Error asignando jugador: ' + error.message)
      // Rollback
      setParticipantesZonificados(prev => prev.filter(pz => pz.id !== tempId))
    } else if (data) {
      // Replace temp entry with real server entry
      setParticipantesZonificados(prev => prev.map(pz => pz.id === tempId ? data : pz))
    }
  }

  const handleRemoveFromZone = async (zonaId: string, participanteId: string) => {
    // Optimistic removal — instant UI feedback
    setParticipantesZonificados(prev => prev.filter(pz => !(pz.zona_id === zonaId && pz.participante_id === participanteId)))
    setPartidosZona(prev => prev.filter(p =>
      !(p.zona_id === zonaId && (p.p1_id === participanteId || p.p2_id === participanteId))
    ))

    await supabase.from('partidos').delete()
      .eq('zona_id', zonaId)
      .or(`participante_1_id.eq.${participanteId},participante_2_id.eq.${participanteId}`)
    const { error } = await supabase.from('participantes_zonas').delete().match({ zona_id: zonaId, participante_id: participanteId })

    if (error) alert('Error quitando jugador: ' + error.message)
  }

  const handleCreateMatch = async () => {
    if (!matchForm.p1 || !matchForm.p2) return alert('Seleccioná los 2 jugadores.')
    if (matchForm.p1 === matchForm.p2) return alert('El jugador 1 y el jugador 2 no pueden ser el mismo.')
    setIsSavingMatch(true)
    const payload = {
      torneo_id: torneoActivo,
      categoria_id: categoriaActiva,
      zona_id: zonaScheduling?.zona.id,
      participante_1_id: matchForm.p1,
      participante_2_id: matchForm.p2,
      fase_bracket: matchForm.fase,
      fecha_hora: matchForm.fechaHora ? new Date(matchForm.fechaHora).toISOString() : null,
      sede_id: matchForm.sedeId || null,
      estado: 'pendiente'
    }
    if (matchForm.id) {
      const { error } = await supabase.from('partidos').update(payload).eq('id', matchForm.id)
      if (error) alert('Error al editar partido: ' + error.message)
    } else {
      const { error } = await supabase.from('partidos').insert(payload)
      if (error) alert('Error al programar partido: ' + error.message)
    }
    setMatchForm({ id: '', p1: '', p2: '', fechaHora: '', sedeId: '', fase: 'Fase de Grupos' })
    setIsModalOpen(false)
    setIsSavingMatch(false)
    // Reload to get fresh partido data with participant names
    loadWorkspace(torneoActivo, categoriaActiva, false)
  }

  const handleRemoveMatch = async (matchId: string) => {
    if (!confirm('¿Eliminar este partido de la zona?')) return
    // Optimistic match removal
    setPartidosZona(prev => prev.filter(p => p.id !== matchId))
    const { error } = await supabase.from('partidos').delete().eq('id', matchId)
    if (error) {
      alert('Error borrando partido: ' + error.message)
      loadWorkspace(torneoActivo, categoriaActiva, false)
    }
  }

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleGenerarCruces = async () => {
    if (zonas.length === 0) return showToast('No hay zonas creadas para generar cruces.', 'error')
    setIsGeneratingCruces(true)

    // Fetch existing zona matches to ensure idempotency
    const zoneIds = zonas.map(z => z.id)
    const { data: existingMatches } = await supabase
      .from('partidos')
      .select('participante_1_id, participante_2_id, zona_id')
      .in('zona_id', zoneIds)

    const existingSet = new Set(
      (existingMatches || []).map(m => {
        const [a, b] = [m.participante_1_id, m.participante_2_id].sort()
        return `${m.zona_id}:${a}:${b}`
      })
    )

    const newMatches: any[] = []

    for (const zona of zonas) {
      const jugadoresDeZona = participantesZonificados
        .filter(pz => pz.zona_id === zona.id)
        .map(pz => pz.participante_id)

      for (let i = 0; i < jugadoresDeZona.length; i++) {
        for (let j = i + 1; j < jugadoresDeZona.length; j++) {
          const p1 = jugadoresDeZona[i]
          const p2 = jugadoresDeZona[j]
          const key = `${zona.id}:${[p1, p2].sort().join(':')}`
          if (!existingSet.has(key)) {
            newMatches.push({
              torneo_id: torneoActivo,
              categoria_id: categoriaActiva,
              zona_id: zona.id,
              participante_1_id: p1,
              participante_2_id: p2,
              fase_bracket: 'Fase de Grupos',
              estado: 'pendiente',
            })
          }
        }
      }
    }

    if (newMatches.length === 0) {
      setIsGeneratingCruces(false)
      return showToast('Todos los cruces ya existen. No se crearon partidos nuevos.', 'success')
    }

    const { error } = await supabase.from('partidos').insert(newMatches)
    setIsGeneratingCruces(false)

    if (error) {
      showToast('Error al generar cruces: ' + error.message, 'error')
    } else {
      showToast(`Se generaron ${newMatches.length} partidos nuevos con éxito.`, 'success')
      loadWorkspace(torneoActivo, categoriaActiva, false)
    }
  }

  if (!userId) return <p className="text-slate-500 text-center py-12">Sin sesión activa.</p>

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="text-brand-500" />
            Armado de Zonas
          </h2>
          <p className="text-slate-400 text-sm mt-1">Configuración manual de grupos para administrar agendas.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={torneoActivo} onChange={e => setTorneoActivo(e.target.value)} className="select-field py-1.5 h-10">
            {torneos.length === 0
              ? <option value="">Sin torneos activos</option>
              : torneos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)
            }
          </select>
          <select value={categoriaActiva} onChange={e => setCategoriaActiva(e.target.value)} className="select-field py-1.5 h-10">
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {!playoffsGenerados && zonas.length > 0 && (
            <button
              id="btn-generar-cruces"
              onClick={handleGenerarCruces}
              disabled={isGeneratingCruces}
              className="flex items-center gap-2 px-4 py-2 h-10 rounded-lg font-semibold text-sm
                bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500
                text-white shadow-lg shadow-violet-900/30 transition-all
                disabled:opacity-50 disabled:pointer-events-none"
            >
              {isGeneratingCruces
                ? <Loader2 size={16} className="animate-spin" />
                : <Zap size={16} />
              }
              Generar Cruces de Zonas
            </button>
          )}
        </div>
      </div>

      {torneos.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-surface-border rounded-3xl text-slate-500">
          <p>No tenés torneos activos. Activá uno desde "Mis Torneos".</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          
          {/* COLUMNA IZQ: JUGADORES SUELTOS */}
          <div className="space-y-4">
            <div className="bg-surface border border-surface-border rounded-xl p-4 sticky top-6">
              <h3 className="font-semibold text-brand-400 mb-2 flex items-center justify-between">
                Disponibles
                <span className="bg-surface-border text-slate-300 px-2 py-0.5 rounded text-xs">{jugadoresSueltos.length} restantes</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4">Click en el menú del jugador para asignarlo a una zona.</p>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                {jugadoresSueltos.length === 0 ? (
                  <div className="text-center p-4 border border-dashed border-surface-border rounded-lg text-slate-500 text-sm">
                    No hay jugadores pendientes
                  </div>
                ) : (
                  jugadoresSueltos.map(ins => (
                    <motion.div key={ins.id} className="bg-surface-card border border-surface-border hover:border-brand-500/50 hover:bg-brand-500/10 transition-colors rounded-lg p-2.5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-surface border border-surface-border flex items-center justify-center text-xs font-bold text-slate-300">
                        {ins.participantes.nombre_mostrado.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-200 truncate">{ins.participantes.nombre_mostrado}</p>
                      </div>
                      {!playoffsGenerados && (
                        <div className="relative">
                          <button onClick={() => setOpenMenuId(openMenuId === ins.id ? null : ins.id)} className="text-slate-500 hover:text-brand-400 p-2 text-lg leading-none">⋮</button>
                          {openMenuId === ins.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-full mt-1 bg-surface-card border border-surface-border rounded-lg shadow-xl z-20 w-36 p-1">
                                {zonas.length === 0
                                  ? <p className="text-[10px] p-2 text-slate-500">Creá zonas primero</p>
                                  : zonas.map(z => (
                                    <button key={z.id} onClick={() => { handleAssignToZone(z.id, ins); setOpenMenuId(null) }} className="block w-full text-left px-3 py-2 hover:bg-brand-500/20 active:bg-brand-500/30 text-xs text-slate-300 rounded">Al {z.nombre}</button>
                                  ))
                                }
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA DER: ZONAS */}
          <div className="space-y-6">
            {playoffsGenerados && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3 text-sm text-amber-300 mb-6">
                 <AlertCircle size={20} className="shrink-0" />
                 <p>La fase eliminatoria ya fue generada. La configuración de zonas y partidos de fase de grupos ha sido bloqueada. Si necesitás realizar cambios, primero debés eliminar TODOS los partidos eliminatorios desde la solapa "Playoffs".</p>
              </div>
            )}

            {!playoffsGenerados && (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Ej: Zona A, Round Robin 1..."
                  value={nuevaZonaName}
                  onChange={e => setNuevaZonaName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateZona()}
                  className="input-field max-w-sm"
                />
                <button onClick={handleCreateZona} className="btn-primary py-2 px-4 shadow-lg shadow-brand-900/20">
                  <Plus size={18} className="inline mr-1" /> Crear Zona
                </button>
              </div>
            )}

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {zonas.map(zona => {
                const participantesDeEstaZona = participantesZonificados.filter(pz => pz.zona_id === zona.id)
                const jDeEstaZona = participantesDeEstaZona.map(pz => {
                  const dataInicial = inscripciones.find(ins => ins.participante_id === pz.participante_id)
                  return { pzId: pz.id, pId: pz.participante_id, ...(dataInicial?.participantes || { nombre_mostrado: 'Desconocido' }) }
                })
                return (
                  <div key={zona.id} className="bg-surface-card border border-surface-border rounded-xl shadow-lg relative min-h-[220px] flex flex-col">
                    <div className="px-4 py-3 border-b border-surface-border/50 flex items-center justify-between bg-surface/30 rounded-t-xl">
                      <h4 className="font-semibold text-brand-300">{zona.nombre}</h4>
                      <span className="text-xs text-slate-500">{jDeEstaZona.length} / 4</span>
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-2">
                      {jDeEstaZona.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-surface-border/40 rounded-lg py-4">
                          <p className="text-xs text-slate-500 font-medium">Vacía</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {jDeEstaZona.map(j => (
                            <div key={j.pId} className="flex items-center justify-between bg-surface border border-surface-border rounded p-1.5 text-xs">
                              <span className="font-medium text-slate-300 truncate pl-1">{j.nombre_mostrado}</span>
                              {!playoffsGenerados && (
                                <button onClick={() => handleRemoveFromZone(zona.id, j.pId)} className="text-red-400 hover:text-red-300 px-2 font-bold hover:bg-red-500/10 rounded ml-2">×</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {partidosZona.filter(p => p.zona_id === zona.id).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-surface-border/50">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Partidos Programados</p>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {partidosZona.filter(p => p.zona_id === zona.id).map(match => (
                              <div key={match.id} className="bg-slate-900/30 border border-brand-500/20 rounded p-2 flex flex-col gap-1.5 group">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-brand-300 font-semibold">{match.p1.nombre_mostrado} vs {match.p2.nombre_mostrado}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${match.estado === 'pendiente' ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>{match.estado}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-slate-500">
                                    {match.fecha_hora
                                      ? new Date(match.fecha_hora).toLocaleDateString() + ' ' + new Date(match.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                      : 'Sin fecha'}
                                  </span>
                                  <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex gap-2">
                                    {match.estado === 'pendiente' && !playoffsGenerados && (
                                      <button className="text-[10px] text-blue-400 hover:text-blue-300" onClick={() => {
                                        setZonaScheduling({ zona, jugadores: jDeEstaZona })
                                        setMatchForm({ id: match.id, p1: match.participante_1_id, p2: match.participante_2_id, fechaHora: match.fecha_hora ? match.fecha_hora.substring(0, 16) : '', sedeId: match.sede_id || '', fase: match.fase_bracket || 'Fase de Grupos' })
                                        setIsModalOpen(true)
                                      }}>Editar</button>
                                    )}
                                    {!playoffsGenerados && (
                                      <button onClick={() => handleRemoveMatch(match.id)} className="text-[10px] text-red-400 hover:text-red-300">Borrar</button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {jugadoresSueltos.length > 0 && jDeEstaZona.length < 4 && !playoffsGenerados && (
                        <div className="mt-2">
                          <select
                            className="w-full text-xs py-1.5 px-2 bg-surface border border-surface-border rounded text-slate-400 focus:text-slate-200 outline-none"
                            value=""
                            onChange={e => {
                              const selected = jugadoresSueltos.find(ins => ins.participante_id === e.target.value)
                              if (selected) handleAssignToZone(zona.id, selected)
                            }}
                          >
                            <option value="" disabled>+ Agregar jugador...</option>
                            {jugadoresSueltos.map(ins => (
                              <option key={ins.id} value={ins.participante_id}>{ins.participantes.nombre_mostrado}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="p-3 border-t border-surface-border/50 bg-slate-900/20">
                      <button
                        disabled={jDeEstaZona.length < 2 || playoffsGenerados}
                        onClick={() => {
                          setZonaScheduling({ zona, jugadores: jDeEstaZona })
                          setMatchForm({ id: '', p1: '', p2: '', fechaHora: '', sedeId: '', fase: 'Fase de Grupos' })
                          setIsModalOpen(true)
                        }}
                        className="w-full text-xs py-2 bg-brand-600/10 hover:bg-brand-500 hover:text-white border border-brand-500/30 font-semibold uppercase tracking-wider rounded-lg text-brand-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Calendar size={14} className="inline mr-1" />
                        Programar Partidos
                      </button>
                    </div>
                  </div>
                )
              })}
              {zonas.length === 0 && (
                <div className="md:col-span-2 xl:col-span-3 text-center py-20 text-slate-500 bg-surface-card border border-surface-border border-dashed rounded-xl">
                  No creaste ninguna zona todavía. Empezá con el botón "Crear Zona".
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      <AnimatePresence>
        {isModalOpen && zonaScheduling && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-surface-border rounded-xl shadow-2xl relative z-10 w-full max-w-lg p-6 flex flex-col gap-5">
              <div>
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Calendar className="text-brand-500" /> Programar Partido</h3>
                <p className="text-sm text-slate-400 mt-1">Para <strong className="text-slate-200">{zonaScheduling.zona.nombre}</strong>.</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">Jugador 1</label>
                    <select className="input-field w-full text-sm" value={matchForm.p1} onChange={e => setMatchForm({ ...matchForm, p1: e.target.value })}>
                      <option value="">Seleccionar...</option>
                      {zonaScheduling.jugadores.map(j => <option key={j.pId} value={j.pId}>{j.nombre_mostrado}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">Jugador 2</label>
                    <select className="input-field w-full text-sm" value={matchForm.p2} onChange={e => setMatchForm({ ...matchForm, p2: e.target.value })}>
                      <option value="">Seleccionar...</option>
                      {zonaScheduling.jugadores.map(j => <option key={j.pId} value={j.pId}>{j.nombre_mostrado}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Fase</label>
                  <select className="input-field w-full text-sm" value={matchForm.fase} onChange={e => setMatchForm({ ...matchForm, fase: e.target.value })}>
                    {['Fase de Grupos', '32avos de Final', '16avos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final'].map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">Fecha y Hora (Opcional)</label>
                    <input type="datetime-local" className="input-field w-full text-sm" value={matchForm.fechaHora} onChange={e => setMatchForm({ ...matchForm, fechaHora: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">Sede (Opcional)</label>
                    <select className="input-field w-full text-sm" value={matchForm.sedeId} onChange={e => setMatchForm({ ...matchForm, sedeId: e.target.value })}>
                      <option value="">Sin definir...</option>
                      {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-4">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
                <button onClick={handleCreateMatch} disabled={isSavingMatch} className="btn-primary py-2 px-5">
                  {isSavingMatch ? <Loader2 size={18} className="animate-spin inline" /> : 'Guardar Partido'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border text-sm font-medium
              ${
                toast.type === 'success'
                  ? 'bg-surface border-green-500/30 text-green-300'
                  : 'bg-surface border-red-500/30 text-red-300'
              }`}
          >
            {toast.type === 'success'
              ? <CheckCircle2 size={18} className="text-green-400 shrink-0" />
              : <AlertCircle size={18} className="text-red-400 shrink-0" />
            }
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
