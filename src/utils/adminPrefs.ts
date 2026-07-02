// Persistencia liviana de la selección de torneo/categoría del panel admin,
// para que el contexto sobreviva al navegar entre secciones.
const PREFIX = 'ttadmin:'

export function loadPref(key: 'torneo' | 'categoria'): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(PREFIX + key) ?? ''
  } catch {
    return ''
  }
}

export function savePref(key: 'torneo' | 'categoria', value: string) {
  if (typeof window === 'undefined' || !value) return
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch {}
}
