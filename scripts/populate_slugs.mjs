/**
 * Script para rellenar el campo slug de la tabla categorias.
 * Uso: node scripts/populate_slugs.mjs
 *
 * Genera el slug desde el campo `nombre` de cada categoría.
 * Las categorías que ya tienen slug NO son modificadas (para no romper URLs activas).
 * Pasá --force para sobreescribir todos.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pygpeoqisaivxotxlpku.supabase.co'
const SUPABASE_KEY = 'sb_publishable_lA1BQv1M-59YOeWfFIqcUw_CE77WSkh'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const force = process.argv.includes('--force')

function toSlug(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

async function main() {
  console.log('=== POPULATE SLUGS — categorias ===\n')

  const { data: categorias, error } = await supabase
    .from('categorias')
    .select('id, nombre, slug')
    .order('nombre')

  if (error) { console.error('Error fetching categorias:', error); process.exit(1) }

  console.log(`Categorías encontradas: ${categorias.length}`)
  if (force) console.log('Modo --force: se sobreescriben todos los slugs.\n')

  const toUpdate = categorias.filter(c => force || !c.slug)
  if (toUpdate.length === 0) {
    console.log('Todas las categorías ya tienen slug. Usá --force para regenerarlos.')
    return
  }

  const updates = []
  const slugsSeen = new Map()

  for (const cat of toUpdate) {
    let slug = toSlug(cat.nombre)
    // Evitar duplicados agregando sufijo numérico
    if (slugsSeen.has(slug)) {
      const count = slugsSeen.get(slug) + 1
      slugsSeen.set(slug, count)
      slug = `${slug}-${count}`
    } else {
      slugsSeen.set(slug, 1)
    }
    updates.push({ id: cat.id, nombre: cat.nombre, slug })
  }

  console.log('Slugs a asignar:')
  updates.forEach(u => console.log(`  "${u.nombre}" → "${u.slug}"`))
  console.log()

  for (const u of updates) {
    const { error: upErr } = await supabase
      .from('categorias')
      .update({ slug: u.slug })
      .eq('id', u.id)

    if (upErr) {
      console.error(`  ❌ Error actualizando "${u.nombre}":`, upErr.message)
    } else {
      console.log(`  ✅ "${u.nombre}" → slug: "${u.slug}"`)
    }
  }

  console.log('\nListo. Verificando estado final:')
  const { data: final } = await supabase.from('categorias').select('nombre, slug').order('nombre')
  final?.forEach(c => console.log(`  ${c.nombre.padEnd(20)} → ${c.slug || '(sin slug)'}`))
}

main().catch(console.error)
