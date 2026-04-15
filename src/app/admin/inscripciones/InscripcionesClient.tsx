'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, UserPlus, Search, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface Props {
  userId: string
}

export default function InscripcionesClient({ userId }: Props) {
  const supabase = createClient()
  
  const [torneos, setTorneos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [torneoActivoId, setTorneoActivoId] = useState<string>('')
  
  const [inscriptos, setInscriptos] = useState<any[]>([])
  const [loadingList, setLoadingList] = useState(false)

  const [categoriaId, setCategoriaId] = useState<string>('')
  
  const [searchQuery, setSearchQuery] = useState('')
  const [participantesDb, setParticipantesDb] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  
  const [selectedParticipante, setSelectedParticipante] = useState<any>(null)
  
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoApellido, setNuevoApellido] = useState('')
  const [nuevoApellido2, setNuevoApellido2] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formMsg, setFormMsg] = useState<{type: 'success'|'error', text: string} | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userId) return
    async function initData() {
      // Solo torneos de este admin
      const { data: resT, error: errT } = await supabase
        .from('torneos')
        .select('*')
        .eq('admin_id', userId)
        .neq('estado', 'Finalizado')

      const { data: resC } = await supabase.from('categorias').select('*')
      
      if (errT) console.error('Error fetching torneos:', errT)

      if (resT && resT.length > 0) {
        const ahora = new Date()
        const torneosVigentes = resT.filter(t => {
          if (!t.fecha_inicio) return true
          const fechaInicioDate = new Date(t.fecha_inicio)
          fechaInicioDate.setDate(fechaInicioDate.getDate() + 1)
          return ahora.getTime() < fechaInicioDate.getTime()
        })
        torneosVigentes.sort((a, b) => {
          if (!a.fecha_inicio) return -1
          if (!b.fecha_inicio) return 1
          return new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime()
        })
        setTorneos(torneosVigentes)
        if (torneosVigentes.length > 0) setTorneoActivoId(torneosVigentes[0].id)
      }
      if (resC) {
        setCategorias(resC)
        if (resC.length > 0) setCategoriaId(resC[0].id)
      }
    }
    initData()
  }, [userId])

  useEffect(() => {
    if (torneoActivoId) fetchInscriptos(torneoActivoId)
  }, [torneoActivoId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchInscriptos = async (tid: string) => {
    setLoadingList(true)
    const { data } = await supabase
      .from('inscripciones')
      .select(`
        id, created_at,
        participantes!inner(id, nombre, apellido, nombre_mostrado),
        categorias!inner(id, nombre)
      `)
      .eq('torneo_id', tid)
      .order('created_at', { ascending: false })
    if (data) setInscriptos(data)
    setLoadingList(false)
  }

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        const { data } = await supabase
          .from('participantes')
          .select('*')
          .ilike('nombre_mostrado', `%${searchQuery}%`)
          .limit(5)
        setParticipantesDb(data || [])
        setShowDropdown(true)
      } else {
        setParticipantesDb([])
        setShowDropdown(false)
      }
    }, 400)
    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!torneoActivoId || !categoriaId) return
    setIsSubmitting(true)
    setFormMsg(null)

    const torneoActivo = torneos.find(t => t.id === torneoActivoId)
    const isDoble = torneoActivo?.modalidad === 'doble'

    let finalParticipanteId = selectedParticipante?.id

    if (!finalParticipanteId) {
      let insertData = {}

      if (isDoble) {
        if (!nuevoApellido || !nuevoApellido2) {
          setFormMsg({ type: 'error', text: 'Completá el apellido de ambos jugadores.' })
          setIsSubmitting(false)
          return
        }
        const concatenatedName = `${nuevoApellido.trim()} - ${nuevoApellido2.trim()}`
        insertData = { nombre: '', apellido: concatenatedName, nombre_mostrado: concatenatedName }
      } else {
        if (!nuevoApellido) {
          setFormMsg({ type: 'error', text: 'Completá al menos el apellido.' })
          setIsSubmitting(false)
          return
        }
        const nombreMostradoGenerado = nuevoNombre
          ? `${nuevoNombre.charAt(0).toUpperCase()}. ${nuevoApellido.charAt(0).toUpperCase() + nuevoApellido.slice(1)}`
          : nuevoApellido.charAt(0).toUpperCase() + nuevoApellido.slice(1)
        insertData = { nombre: nuevoNombre, apellido: nuevoApellido, nombre_mostrado: nombreMostradoGenerado }
      }

      const { data: newP, error: pError } = await supabase
        .from('participantes')
        .insert(insertData)
        .select('id').single()

      if (pError) {
        setFormMsg({ type: 'error', text: 'Error creando participante: ' + pError.message })
        setIsSubmitting(false)
        return
      }
      finalParticipanteId = newP.id
    }

    const { error: insError } = await supabase
      .from('inscripciones')
      .insert({ torneo_id: torneoActivoId, participante_id: finalParticipanteId, categoria_id: categoriaId })

    if (insError) {
      if (insError.code === '23505') {
        setFormMsg({ type: 'error', text: 'Este jugador ya está inscripto en el torneo.' })
      } else {
        setFormMsg({ type: 'error', text: 'Error en inscripción: ' + insError.message })
      }
    } else {
      setFormMsg({ type: 'success', text: '¡Jugador inscripto con éxito!' })
      setSelectedParticipante(null)
      setSearchQuery('')
      setNuevoNombre('')
      setNuevoApellido('')
      setNuevoApellido2('')
      fetchInscriptos(torneoActivoId)
      setTimeout(() => setFormMsg(null), 3500)
    }
    setIsSubmitting(false)
  }

  const handleRemoveInscripcion = async (id: string, participanteId: string, nombre: string) => {
    if (!confirm(`¿Seguro querés dar de baja a ${nombre} de este torneo?`)) return
    await supabase.from('partidos').delete()
      .or(`participante_1_id.eq.${participanteId},participante_2_id.eq.${participanteId}`)
      .eq('torneo_id', torneoActivoId)
    const { error } = await supabase.from('inscripciones').delete().eq('id', id)
    if (error) {
      alert('Error al dar de baja: ' + error.message)
    } else {
      fetchInscriptos(torneoActivoId)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <UserPlus className="text-brand-500" />
          Inscripciones
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Buscá jugadores del club o dálos de alta para competir en el torneo actual.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.5fr] gap-8 transform-gpu">
        
        {/* COLUMNA IZQUIERDA: FORMULARIO */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-lg h-fit sticky top-24">
          <h3 className="font-semibold text-brand-400 mb-5 pb-2 border-b border-surface-border/50">Formulario de Fichaje</h3>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Torneo Activo */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Torneo Activo</label>
              <select
                value={torneoActivoId}
                onChange={e => setTorneoActivoId(e.target.value)}
                className="select-field"
                disabled={torneos.length === 0}
              >
                {torneos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                {torneos.length === 0 && <option value="">No hay torneos creados</option>}
              </select>
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Categoría a jugar</label>
              <select
                value={categoriaId}
                onChange={e => setCategoriaId(e.target.value)}
                className="select-field"
                disabled={categorias.length === 0}
              >
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            {/* Ficha Jugador */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Jugador / Equipo</label>

              {(() => {
                const isDoble = torneos.find(t => t.id === torneoActivoId)?.modalidad === 'doble'

                if (selectedParticipante) {
                  return (
                    <div className="flex items-center justify-between bg-brand-600/10 border border-brand-500/30 rounded-lg p-3">
                      <div>
                        <p className="text-sm text-brand-300 font-bold">{selectedParticipante.nombre_mostrado}</p>
                        <p className="text-xs text-brand-500/70">Historial</p>
                      </div>
                      <button type="button" onClick={() => setSelectedParticipante(null)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 bg-red-400/10 rounded">Desvincular</button>
                    </div>
                  )
                }

                return (
                  <div className="space-y-4">
                    {!isDoble && (
                      <>
                        <div className="relative" ref={dropdownRef}>
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            placeholder="Buscar por nombre o apellido..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onFocus={() => { if (participantesDb.length > 0) setShowDropdown(true) }}
                            className="input-field pl-10"
                          />
                          <AnimatePresence>
                            {showDropdown && participantesDb.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="absolute z-10 w-full mt-1 bg-surface-card border border-surface-border rounded-lg shadow-xl overflow-hidden"
                              >
                                {participantesDb.map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => { setSelectedParticipante(p); setShowDropdown(false); setSearchQuery('') }}
                                    className="w-full text-left px-4 py-2.5 hover:bg-surface-hover text-sm border-b border-surface-border/50 last:border-0"
                                  >
                                    <span className="font-semibold text-slate-200">{p.nombre_mostrado}</span>
                                    {(p.nombre || p.apellido) && <span className="text-slate-500 text-xs ml-2">({p.nombre} {p.apellido})</span>}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="h-px bg-surface-border flex-1"></div>
                          <span className="text-xs text-slate-500 font-semibold uppercase">O Crear Nuevo</span>
                          <div className="h-px bg-surface-border flex-1"></div>
                        </div>
                      </>
                    )}

                    {isDoble ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input type="text" placeholder="Apellido Jugador 1" value={nuevoApellido} onChange={e => setNuevoApellido(e.target.value)} className="input-field" />
                          <input type="text" placeholder="Apellido Jugador 2" value={nuevoApellido2} onChange={e => setNuevoApellido2(e.target.value)} className="input-field" />
                        </div>
                        <p className="text-[11px] text-slate-500">Ejemplo: Perez - Gomez</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input type="text" placeholder="Inicial (Ej: J)" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} className="input-field" />
                          <input type="text" placeholder="Apellido" value={nuevoApellido} onChange={e => setNuevoApellido(e.target.value)} className="input-field" />
                        </div>
                        <p className="text-[11px] text-slate-500">Formato generado: J. Apellido</p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {formMsg && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className={`p-3 rounded-lg text-sm flex gap-2 items-center ${formMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'}`}>
                {formMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                <span>{formMsg.text}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || torneos.length === 0}
              className="btn-primary w-full py-3 text-base shadow-lg shadow-brand-900/20 mt-6"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : 'Inscribir a Torneo'}
            </button>
          </form>
        </div>

        {/* COLUMNA DERECHA: GRILLA DE INSCRIPTOS */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="font-semibold text-slate-200">Jugadores Registrados</h3>
            <span className="text-xs font-semibold text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-full">Total: {inscriptos.length}</span>
          </div>

          {loadingList ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-500" /></div>
          ) : inscriptos.length === 0 ? (
            <div className="bg-surface-card border border-surface-border border-dashed rounded-xl p-12 text-center text-slate-500">
              <p>Todavía no hay jugadores en este torneo.</p>
              <p className="text-xs mt-1">Utilizá el formulario para dar la primera alta.</p>
            </div>
          ) : (
            <motion.div
              initial="hidden" animate="show"
              variants={{ show: { transition: { staggerChildren: 0.08 } } }}
              className="grid sm:grid-cols-2 gap-3"
            >
              {inscriptos.map(ins => (
                <motion.div
                  key={ins.id}
                  variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
                  className="bg-surface-card border border-surface-border hover:border-surface-border/80 rounded-lg p-3.5 flex items-center gap-4 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center text-brand-400 font-bold uppercase shrink-0">
                    {ins.participantes.nombre?.charAt(0) || ins.participantes.nombre_mostrado.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-200 truncate">{ins.participantes.nombre_mostrado}</p>
                    <p className="text-xs text-slate-500 truncate">{ins.categorias.nombre}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveInscripcion(ins.id, ins.participante_id || ins.participantes.id, ins.participantes.nombre_mostrado)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-2 shrink-0"
                    title="Dar de baja del torneo"
                  >
                    ×
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
