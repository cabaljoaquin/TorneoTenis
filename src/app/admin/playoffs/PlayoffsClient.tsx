'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitBranch, Loader2, Save, AlertCircle, CheckCircle2, Zap, Trophy, RefreshCw } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import TournamentBracket from '@/components/public/TournamentBracket'
import { calculateStandings, parseOrigen } from '@/utils/standingsCalculator'

const FASES_OPTIONS = ['Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final']

const MATCHES_PER_FASE: Record<string, number> = {
  'Octavos de Final': 8,
  'Cuartos de Final': 4,
  'Semifinal': 2,
  'Final': 1,
}

const POS_LABELS = ['1ro', '2do', '3ro', '4to', '5to', '6to']

interface Cruce {
  p1: string
  p2: string
}

interface Props {
  userId: string
}

export default function PlayoffsClient({ userId }: Props) {
  const supabase = createClient()

  const [torneos, setTorneos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [torneoActivo, setTorneoActivo] = useState('')
  const [categoriaActiva, setCategoriaActiva] = useState('')
  const [faseActiva, setFaseActiva] = useState('Cuartos de Final')

  const [zonas, setZonas] = useState<any[]>([])
  const [cruces, setCruces] = useState<Cruce[]>([])

  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [playoffsYaGenerados, setPlayoffsYaGenerados] = useState(false)
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const matchCount = MATCHES_PER_FASE[faseActiva] || 1

  const origenOptions = useMemo(() => {
    const opts: string[] = []
    POS_LABELS.slice(0, 4).forEach((pos) => {
      zonas.forEach((z) => opts.push(`${pos} ${z.nombre}`))
    })
    return opts
  }, [zonas])

  // Un origen no puede repetirse entre partidos distintos de la misma fase.
  // Dentro del mismo partido, p1 y p2 deben ser distintos.
  // Si una posicion ya fue asignada en otra fila, desaparece de las opciones restantes.
  const getAvailableOptions = (matchIdx: number, field: 'p1' | 'p2'): string[] => {
    const taken = new Set<string>()
    cruces.forEach((cruce, i) => {
      if (i === matchIdx) {
        const opposite = field === 'p1' ? cruce.p2 : cruce.p1
        if (opposite) taken.add(opposite)
      } else {
        if (cruce.p1) taken.add(cruce.p1)
        if (cruce.p2) taken.add(cruce.p2)
      }
    })
    const currentValue = cruces[matchIdx]?.[field]
    return origenOptions.filter((o) => !taken.has(o) || o === currentValue)
  }

  const addMatch = () => setCruces((prev) => [...prev, { p1: '', p2: '' }])
  const removeMatch = (i: number) => setCruces((prev) => prev.filter((_, j) => j !== i))

  // Init: load torneos y categorias
  useEffect(() => {
    if (!userId) return
    async function init() {
      const [{ data: ts }, { data: cs }] = await Promise.all([
        supabase.from('torneos').select('id, nombre').eq('admin_id', userId).neq('estado', 'Finalizado').order('created_at', { ascending: false }),
        supabase.from('categorias').select('id, nombre').order('nombre'),
      ])
      if (ts && ts.length > 0) {
        setTorneos(ts)
        setTorneoActivo(ts[0].id)
      } else {
        setTorneos([])
        setLoading(false)
      }
      if (cs && cs.length > 0) {
        setCategorias(cs)
        setCategoriaActiva(cs[0].id)
      }
    }
    init()
  }, [userId])

  useEffect(() => {
    if (torneoActivo && categoriaActiva) loadWorkspace()
  }, [torneoActivo, categoriaActiva, faseActiva])

  const loadWorkspace = async () => {
    setLoading(true)
    setMsg(null)

    const [{ data: zs }, { data: configLlave }, { count: existCount }, { count: pendCount }] =
      await Promise.all([
        supabase
          .from('zonas')
          .select('id, nombre')
          .eq('torneo_id', torneoActivo)
          .eq('categoria_id', categoriaActiva)
          .order('nombre'),
        supabase
          .from('configuracion_llave')
          .select('*')
          .eq('torneo_id', torneoActivo)
          .eq('categoria_id', categoriaActiva)
          .eq('fase', faseActiva)
          .order('match_index'),
        supabase
          .from('partidos')
          .select('id', { count: 'exact', head: true })
          .eq('torneo_id', torneoActivo)
          .eq('categoria_id', categoriaActiva)
          .not('fase_bracket', 'is', null)
          .neq('fase_bracket', 'Fase de Grupos'),
        supabase
          .from('partidos')
          .select('id', { count: 'exact', head: true })
          .eq('torneo_id', torneoActivo)
          .eq('categoria_id', categoriaActiva)
          .not('zona_id', 'is', null)
          .neq('estado', 'finalizado'),
      ])

    setZonas(zs || [])
    setPlayoffsYaGenerados((existCount ?? 0) > 0)
    setPendingCount(pendCount ?? 0)

    // Restaurar configuracion guardada o inicializar vacío
    const count = MATCHES_PER_FASE[faseActiva] || 1
    const restored = Array.from({ length: count }, (_, i) => {
      const saved = configLlave?.find((c) => c.match_index === i)
      return saved ? { p1: saved.origen_p1, p2: saved.origen_p2 } : { p1: '', p2: '' }
    })
    setCruces(restored)
    setLoading(false)
  }

  const handleSaveConfig = async () => {
    setIsSaving(true)
    setMsg(null)

    const toUpsert = cruces
      .map((c, i) => ({
        torneo_id: torneoActivo,
        categoria_id: categoriaActiva,
        fase: faseActiva,
        match_index: i,
        origen_p1: c.p1,
        origen_p2: c.p2,
      }))
      .filter((c) => c.origen_p1 && c.origen_p2)

    if (toUpsert.length === 0) {
      setMsg({ type: 'error', text: 'Completá al menos un cruce antes de guardar.' })
      setIsSaving(false)
      return
    }

    const { error } = await supabase.from('configuracion_llave').upsert(toUpsert, {
      onConflict: 'torneo_id,categoria_id,fase,match_index',
    })

    setMsg(
      error
        ? { type: 'error', text: 'Error al guardar: ' + error.message }
        : { type: 'success', text: 'Configuración guardada. Ya es visible en la vista pública.' }
    )
    setIsSaving(false)
  }

  const handleGeneratePlayoffs = async () => {
    setIsGenerating(true)
    setMsg(null)

    // Guard: ya generados
    const { count: existCount } = await supabase
      .from('partidos')
      .select('id', { count: 'exact', head: true })
      .eq('torneo_id', torneoActivo)
      .eq('categoria_id', categoriaActiva)
      .not('fase_bracket', 'is', null)
      .neq('fase_bracket', 'Fase de Grupos')

    if ((existCount ?? 0) > 0) {
      setMsg({
        type: 'error',
        text: 'Ya existen partidos eliminatorios generados para esta categoría. Para regenerar, borrá los existentes desde Gestión de Partidos.',
      })
      setIsGenerating(false)
      return
    }

    // Guard: partidos zona pendientes
    const { count: pendCount } = await supabase
      .from('partidos')
      .select('id', { count: 'exact', head: true })
      .eq('torneo_id', torneoActivo)
      .eq('categoria_id', categoriaActiva)
      .not('zona_id', 'is', null)
      .neq('estado', 'finalizado')

    if ((pendCount ?? 0) > 0) {
      setMsg({
        type: 'error',
        text: `No se puede generar: hay ${pendCount} partido(s) de zona pendiente(s). Finalizá todos los partidos antes de continuar.`,
      })
      setPendingCount(pendCount ?? 0)
      setIsGenerating(false)
      return
    }

    // Guard: cruces incompletos
    const crucesIncompletos = cruces.filter((c) => !c.p1 || !c.p2)
    if (crucesIncompletos.length > 0) {
      setMsg({ type: 'error', text: 'Hay cruces sin definir. Completá toda la configuración de la llave antes de generar.' })
      setIsGenerating(false)
      return
    }

    // Identificar el índice de la fase inicial
    const startIndex = FASES_OPTIONS.indexOf(faseActiva)
    if (startIndex === -1) {
      setMsg({ type: 'error', text: 'Fase inicial desconocida.' })
      setIsGenerating(false)
      return
    }

    // Cargar datos para calcular posiciones
    const { data: zonasConPart } = await supabase
      .from('zonas')
      .select('id, nombre, participantes_zonas(participantes(id, nombre_mostrado))')
      .eq('torneo_id', torneoActivo)
      .eq('categoria_id', categoriaActiva)

    const zoneIds = (zonasConPart || []).map((z) => z.id)

    const { data: allPartidos } = await supabase
      .from('partidos')
      .select('id, estado, resultado, zona_id, ganador_id, p1:participantes!participante_1_id(id, nombre_mostrado), p2:participantes!participante_2_id(id, nombre_mostrado)')
      .in('zona_id', zoneIds.length ? zoneIds : ['__none__'])

    // Calcular standings por zona
    const standingsMap = new Map<string, any[]>()
    ;(zonasConPart || []).forEach((zona) => {
      const zPartidos = (allPartidos || []).filter((p) => p.zona_id === zona.id)
      standingsMap.set(zona.id, calculateStandings((zona.participantes_zonas as any[]) || [], zPartidos))
    })

    // Sede del torneo
    const { data: torneoData } = await supabase
      .from('torneos')
      .select('sede_id')
      .eq('id', torneoActivo)
      .single()

    const sedeId = torneoData?.sede_id || null

    // Resolver cruces → participante_id reales
    // Usamos Web Crypto API para pre-generar los UUIDs del árbol completo
    const treeLevels = []
    let currentMatchCount = cruces.length
    let phaseIndexOffset = 0

    // Construir la estructura lógica del árbol
    while (currentMatchCount >= 1) {
      const levelMatches = []
      const currentFaseName = FASES_OPTIONS[startIndex + phaseIndexOffset] || `Siguiente Fase (${phaseIndexOffset})`

      for (let i = 0; i < currentMatchCount; i++) {
        levelMatches.push({
          id: crypto.randomUUID(),
          fase_bracket: currentFaseName,
          bracket_index: i,
          participante_1_id: null as string | null,
          participante_2_id: null as string | null,
          siguiente_partido_id: null as string | null,
          posicion_siguiente_partido: null as number | null,
        })
      }
      treeLevels.push(levelMatches)

      if (currentMatchCount === 1) break
      currentMatchCount = Math.ceil(currentMatchCount / 2)
      phaseIndexOffset++
    }

    // Vincular siguientes partidos y armar los participantes de la fase inicial
    for (let levelIdx = 0; levelIdx < treeLevels.length; levelIdx++) {
      const currentLevel = treeLevels[levelIdx]
      const nextLevel = treeLevels[levelIdx + 1]

      for (let i = 0; i < currentLevel.length; i++) {
        const match = currentLevel[i]

        // Asignar participantes reales SOLO para la primer fase (Nivel 0)
        if (levelIdx === 0) {
          const cruce = cruces[i]
          const p1id = parseOrigen(cruce.p1, zonasConPart || [], standingsMap)
          const p2id = parseOrigen(cruce.p2, zonasConPart || [], standingsMap)

          if (!p1id || !p2id) {
            setMsg({
              type: 'error',
              text: `No se pudo resolver el cruce ${i + 1}: "${cruce.p1}" vs "${cruce.p2}".`,
            })
            setIsGenerating(false)
            return
          }
          match.participante_1_id = p1id
          match.participante_2_id = p2id
        }

        // Conectar con el partido de la fase siguiente
        if (nextLevel) {
          const nextMatchIdx = Math.floor(i / 2)
          if (nextLevel[nextMatchIdx]) {
            match.siguiente_partido_id = nextLevel[nextMatchIdx].id
            match.posicion_siguiente_partido = (i % 2) === 0 ? 1 : 2 // 1: Arriba(p1), 2: Abajo(p2)
          }
        }
      }
    }

    const partidosInsert: any[] = []
    treeLevels.forEach(level => {
      level.forEach(m => {
        partidosInsert.push({
          id: m.id,
          torneo_id: torneoActivo,
          categoria_id: categoriaActiva,
          fase_bracket: m.fase_bracket,
          bracket_index: m.bracket_index,
          participante_1_id: m.participante_1_id,
          participante_2_id: m.participante_2_id,
          siguiente_partido_id: m.siguiente_partido_id,
          posicion_siguiente_partido: m.posicion_siguiente_partido,
          sede_id: sedeId,
          estado: 'pendiente'
        })
      })
    })

    // INSERT atómico
    const { error } = await supabase.from('partidos').insert(partidosInsert)
    if (error) {
      setMsg({ type: 'error', text: 'Error al generar la llave completa: ' + error.message })
    } else {
      setMsg({
        type: 'success',
        text: `✅ Llave generada completamente (${partidosInsert.length} partidos totales).`,
      })
      setPlayoffsYaGenerados(true)
      setPendingCount(0)
    }
    setIsGenerating(false)
  }

  // Preview teórico de la llave
  const theoreticalRounds = useMemo(() => {
    const hasAny = cruces.some((c) => c.p1 || c.p2)
    if (!hasAny) return []
    return [
      {
        title: faseActiva,
        matches: cruces.map((c, i) => ({
          id: `preview-${i}`,
          p1: c.p1 || 'Por definir',
          p2: c.p2 || 'Por definir',
          isPlaceholder: true,
        })),
      },
    ]
  }, [cruces, faseActiva])


  const allCrucesValid = cruces.length > 0 && cruces.every((c) => c.p1 && c.p2)
  const canGenerate = !playoffsYaGenerados && allCrucesValid && pendingCount === 0


  if (!userId) return <p className="text-slate-500 text-center py-12">Sin sesión activa.</p>

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <GitBranch className="text-brand-500" />
            Armar Fase Eliminatoria
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Configurá los cruces teóricos, guardá, y cuando todas las zonas estén cerradas usá el botón para generar.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select value={torneoActivo} onChange={(e) => setTorneoActivo(e.target.value)} className="select-field py-1.5 h-10">
            {torneos.length === 0
              ? <option value="">Sin torneos activos</option>
              : torneos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)
            }
          </select>
          <select value={categoriaActiva} onChange={(e) => setCategoriaActiva(e.target.value)} className="select-field py-1.5 h-10">
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={faseActiva} onChange={(e) => setFaseActiva(e.target.value)} className="select-field py-1.5 h-10">
            {FASES_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {torneos.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-surface-border rounded-3xl text-slate-500">
          <p>No tenés torneos activos. Activá uno desde "Mis Torneos".</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-500" /></div>
      ) : (
        <>
          <AnimatePresence>
            {msg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
                  msg.type === 'error'
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : 'bg-green-500/10 border-green-500/30 text-green-300'
                }`}
              >
                {msg.type === 'error'
                  ? <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  : <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                }
                <p>{msg.text}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">

            {/* COLUMNA IZQUIERDA: Configurador + Panel de estado */}
            <div className="space-y-4">

              {/* Configurador de cruces */}
              <div className="bg-surface-card border border-surface-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-200">
                    Cruces Teóricos
                    <span className="text-xs text-slate-500 font-normal ml-2">
                      ({cruces.length} partido{cruces.length !== 1 ? 's' : ''} — {faseActiva})
                    </span>
                  </h3>
                  <button onClick={loadWorkspace} className="text-slate-500 hover:text-brand-400 transition-colors" title="Recargar">
                    <RefreshCw size={14} />
                  </button>
                </div>

                {zonas.length === 0 ? (
                  <p className="text-slate-500 text-sm">No hay zonas configuradas para este torneo/categoría. Creá las zonas primero en "Cuadros".</p>
                ) : (
                  <div className="space-y-3">
                    {cruces.map((cruce, i) => {
                      const optsP1 = getAvailableOptions(i, 'p1')
                      const optsP2 = getAvailableOptions(i, 'p2')
                      return (
                        <div
                          key={i}
                          className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2 bg-surface/50 border border-surface-border rounded-lg p-3"
                        >
                          <span className="text-[10px] font-bold text-slate-600 w-5 text-center">{i + 1}</span>
                          <select
                            value={cruce.p1}
                            onChange={(e) =>
                              setCruces((prev) => prev.map((c, j) => (j === i ? { ...c, p1: e.target.value } : c)))
                            }
                            className="select-field text-sm py-1.5"
                          >
                            <option value="">Seleccionar...</option>
                            {optsP1.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <span className="text-slate-600 font-bold text-xs uppercase text-center px-1">vs</span>
                          <select
                            value={cruce.p2}
                            onChange={(e) =>
                              setCruces((prev) => prev.map((c, j) => (j === i ? { ...c, p2: e.target.value } : c)))
                            }
                            className="select-field text-sm py-1.5"
                          >
                            <option value="">Seleccionar...</option>
                            {optsP2.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <button
                            onClick={() => removeMatch(i)}
                            className="ml-1 text-slate-600 hover:text-red-400 transition-colors p-1 rounded"
                            title="Quitar partido"
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}

                    <button
                      onClick={addMatch}
                      className="w-full py-2 border border-dashed border-surface-border rounded-lg text-slate-500 hover:text-brand-400 hover:border-brand-500/40 text-xs font-semibold transition-colors"
                    >
                      + Agregar partido
                    </button>
                  </div>
                )}

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={handleSaveConfig}
                    disabled={isSaving || zonas.length === 0}
                    className="btn-primary py-2 px-5 disabled:opacity-40"
                  >
                    {isSaving
                      ? <Loader2 size={16} className="animate-spin inline mr-2" />
                      : <Save size={16} className="inline mr-2" />
                    }
                    Guardar Configuración
                  </button>
                </div>
              </div>

              {/* Panel de estado y generación */}
              <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-slate-200">Finalizar Zona y Generar Eliminatoria</h3>

                {playoffsYaGenerados && (
                  <div className="flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <Trophy size={16} className="text-purple-400 shrink-0" />
                    <div>
                      <p className="text-purple-300 text-sm font-semibold">Partidos ya generados</p>
                      <p className="text-purple-400/80 text-xs mt-0.5">Los partidos eliminatorios de esta categoría y fase ya existen. Gestioná sus resultados desde Partidos.</p>
                    </div>
                  </div>
                )}

                {pendingCount === null ? null : pendingCount > 0 ? (
                  <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-300 text-sm font-semibold">Zona no finalizada</p>
                      <p className="text-amber-400/80 text-xs mt-0.5">
                        Hay <strong>{pendingCount}</strong> partido(s) pendiente(s) en la fase de grupos.
                        No se pueden generar los cruces reales hasta que todos estén finalizados.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-300 text-sm">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>Todos los partidos de la zona están finalizados.</span>
                  </div>
                )}

                {!allCrucesValid && !playoffsYaGenerados && (
                  <div className="flex items-start gap-3 p-3 bg-surface/50 border border-surface-border rounded-lg">
                    <AlertCircle size={16} className="text-slate-500 shrink-0 mt-0.5" />
                    <p className="text-slate-500 text-xs">
                      Completá y guardá todos los cruces de la llave antes de poder generar los partidos.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleGeneratePlayoffs}
                  disabled={!canGenerate || isGenerating}
                  className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-30 disabled:pointer-events-none shadow-lg shadow-brand-900/30"
                >
                  {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                  Generar Partidos Eliminatorios
                </button>

                <p className="text-[11px] text-slate-600 text-center leading-relaxed">
                  Esta acción crea todos los partidos de una sola vez de forma atómica.<br />
                  Solo se ejecuta si todas las zonas están cerradas y la llave está completa.
                </p>
              </div>
            </div>

            {/* COLUMNA DERECHA: Preview de llave */}
            <div className="bg-surface-card border border-surface-border rounded-xl p-5 sticky top-6">
              <div className="mb-4">
                <h3 className="font-semibold text-slate-200">Preview de la Llave</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Se actualiza en tiempo real. Los nombres reales se asignan al generar.
                </p>
              </div>

              {theoreticalRounds.length > 0 ? (
                <div className="overflow-x-auto">
                  <TournamentBracket rounds={theoreticalRounds} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-600 gap-2">
                  <GitBranch size={32} className="opacity-30" />
                  <p className="text-sm">Configurá los cruces para ver el preview</p>
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  )
}
