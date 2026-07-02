'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { SkeletonChips } from '@/components/ui/Skeletons'
import { Loader2, Star, MapPin, Tag } from 'lucide-react'

interface Sede {
  id: string
  nombre: string
  es_principal: boolean
}

interface Categoria {
  id: string
  nombre: string
  genero: string
}

const genderConfig: Record<string, { label: string; className: string }> = {
  Masculino: { label: 'M',  className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  Femenino:  { label: 'F',  className: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
  Mixto:     { label: 'Mx', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

export default function ConfiguracionPage() {
  const supabase = createClient()
  const { toast } = useFeedback()

  // ── Sedes ──────────────────────────────────────────────────────────────────
  const [sedeName, setSedeName]       = useState('')
  const [esPrincipal, setEsPrincipal] = useState(false)
  const [sedeSaving, setSedeSaving]   = useState(false)
  const [sedes, setSedes]             = useState<Sede[]>([])
  const [sedesLoading, setSedesLoading] = useState(true)

  // ── Categorías ─────────────────────────────────────────────────────────────
  const [catName, setCatName]       = useState('')
  const [catGender, setCatGender]   = useState('Mixto')
  const [catSaving, setCatSaving]   = useState(false)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [catsLoading, setCatsLoading] = useState(true)

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchSedes = useCallback(async () => {
    setSedesLoading(true)
    const { data } = await supabase.from('sedes').select('id, nombre, es_principal').order('nombre')
    if (data) setSedes(data)
    setSedesLoading(false)
  }, [supabase])

  const fetchCategorias = useCallback(async () => {
    setCatsLoading(true)
    const { data } = await supabase.from('categorias').select('id, nombre, genero').order('nombre')
    if (data) setCategorias(data)
    setCatsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchSedes()
    fetchCategorias()
  }, [fetchSedes, fetchCategorias])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSedeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSedeSaving(true)
    const { error } = await supabase.from('sedes').insert({ nombre: sedeName, es_principal: esPrincipal })
    if (error) {
      toast('Error guardando la sede: ' + error.message, 'error')
    } else {
      toast('Sede guardada.')
      setSedeName('')
      setEsPrincipal(false)
      await fetchSedes()
    }
    setSedeSaving(false)
  }

  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCatSaving(true)
    const { error } = await supabase.from('categorias').insert({ nombre: catName, genero: catGender })
    if (error) {
      toast('Error guardando la categoría: ' + error.message, 'error')
    } else {
      toast('Categoría guardada.')
      setCatName('')
      await fetchCategorias()
    }
    setCatSaving(false)
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Configuración</h2>
        <p className="text-slate-500 text-sm mt-1">Alta de parámetros base del sistema.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* ── Card Sede ── */}
        <div className="card p-5 flex flex-col gap-5">
          {/* Formulario */}
          <div>
            <h3 className="font-semibold text-brand-400 mb-4 flex items-center gap-2">
              <MapPin size={15} />
              Nueva Sede
            </h3>
            <form onSubmit={handleSedeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={sedeName}
                  onChange={e => setSedeName(e.target.value)}
                  className="input-field"
                  placeholder="Ej: Club de Tenis Las Lomas"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={esPrincipal}
                  onChange={e => setEsPrincipal(e.target.checked)}
                  className="rounded border-surface-border text-brand-600 focus:ring-brand-500 bg-surface"
                />
                <span className="text-sm text-slate-300">Es sede principal</span>
              </label>
              <button disabled={sedeSaving} type="submit" className="btn-primary w-full mt-2">
                {sedeSaving ? <Loader2 className="animate-spin" size={16} /> : 'Guardar Sede'}
              </button>
            </form>
          </div>

          {/* Lista existente */}
          <div className="border-t border-surface-border/50 pt-4">
            <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">
              Existentes {!sedesLoading && `(${sedes.length})`}
            </p>
            {sedesLoading ? (
              <SkeletonChips />
            ) : sedes.length === 0 ? (
              <p className="text-xs text-slate-600 italic">Aún no hay sedes registradas.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sedes.map(s => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-slate-800/60 text-slate-300 border-slate-700/60 transition-colors"
                  >
                    {s.es_principal && (
                      <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />
                    )}
                    {s.nombre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Card Categoría ── */}
        <div className="card p-5 flex flex-col gap-5">
          {/* Formulario */}
          <div>
            <h3 className="font-semibold text-brand-400 mb-4 flex items-center gap-2">
              <Tag size={15} />
              Nueva Categoría
            </h3>
            <form onSubmit={handleCatSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  className="input-field"
                  placeholder="Ej: 3ra, 4ta, Damas A"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Género</label>
                <select
                  value={catGender}
                  onChange={e => setCatGender(e.target.value)}
                  className="input-field appearance-none"
                >
                  <option>Masculino</option>
                  <option>Femenino</option>
                  <option>Mixto</option>
                </select>
              </div>
              <button disabled={catSaving} type="submit" className="btn-primary w-full mt-2">
                {catSaving ? <Loader2 className="animate-spin" size={16} /> : 'Guardar Categoría'}
              </button>
            </form>
          </div>

          {/* Lista existente */}
          <div className="border-t border-surface-border/50 pt-4">
            <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">
              Existentes {!catsLoading && `(${categorias.length})`}
            </p>
            {catsLoading ? (
              <SkeletonChips />
            ) : categorias.length === 0 ? (
              <p className="text-xs text-slate-600 italic">Aún no hay categorías registradas.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categorias.map(c => {
                  const gender = genderConfig[c.genero] ?? genderConfig['Mixto']
                  return (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-slate-800/60 text-slate-300 border-slate-700/60"
                    >
                      {c.nombre}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${gender.className}`}>
                        {gender.label}
                      </span>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
