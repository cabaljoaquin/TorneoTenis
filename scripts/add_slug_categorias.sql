-- =========================================================================
-- TORNEO TENIS — Agregar columna slug a la tabla categorias
-- Ejecutá esto en el "SQL Editor" de Supabase ANTES de correr populate_slugs.mjs
-- =========================================================================

-- 1. Agregar la columna (si no existe)
ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Agregar restricción de unicidad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categorias_slug_unique'
  ) THEN
    ALTER TABLE public.categorias
      ADD CONSTRAINT categorias_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- 3. Auto-generar slugs para las categorias existentes sin slug
--    Convierte el nombre a lowercase, elimina acentos y reemplaza espacios por guiones
UPDATE public.categorias
SET slug = lower(
  regexp_replace(
    regexp_replace(
      translate(
        nombre,
        'áéíóúàèìòùäëïöüâêîôûÁÉÍÓÚÑñ',
        'aeiouaeiouaeiouaeiouAEIOUNn'
      ),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL OR slug = '';

-- 4. Verificar resultados
SELECT id, nombre, slug FROM public.categorias ORDER BY nombre;
