import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pygpeoqisaivxotxlpku.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lA1BQv1M-59YOeWfFIqcUw_CE77WSkh';
const CATEGORIA_ID = '5183bca5-211b-4f29-817d-c7f8ee1685d3';
const ZONAS_A_CONSERVAR = ['Zona A', 'Zona B'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanup() {
  console.log('=== CLEANUP CATEGORÍA 5TA ===\n');

  // 1. Obtener todas las zonas de la categoría
  const { data: todasZonas, error: errorZonas } = await supabase
    .from('zonas')
    .select('id, nombre')
    .eq('categoria_id', CATEGORIA_ID);

  if (errorZonas) { console.error('Error obteniendo zonas:', errorZonas); process.exit(1); }
  console.log('Zonas encontradas:', todasZonas.map(z => z.nombre));

  const zonasAEliminar = todasZonas.filter(z => !ZONAS_A_CONSERVAR.includes(z.nombre));
  const idsZonasAEliminar = zonasAEliminar.map(z => z.id);

  console.log('\nZonas a conservar:', todasZonas.filter(z => ZONAS_A_CONSERVAR.includes(z.nombre)).map(z => z.nombre));
  console.log('Zonas a eliminar:', zonasAEliminar.map(z => z.nombre));

  if (idsZonasAEliminar.length === 0) {
    console.log('\nNo hay zonas para eliminar. Saliendo.');
    return;
  }

  // 2. Eliminar partidos de fase de grupos vinculados a esas zonas
  console.log('\n[1/4] Eliminando partidos de esas zonas...');
  const { data: partidosEliminados, error: errPartidos } = await supabase
    .from('partidos')
    .delete()
    .in('zona_id', idsZonasAEliminar)
    .select('id');
  if (errPartidos) { console.error('Error:', errPartidos); process.exit(1); }
  console.log(`  -> ${partidosEliminados?.length ?? 0} partidos eliminados.`);

  // 3. Eliminar partidos de eliminatorias de la categoría (NO son de Zona A ni Zona B específicamente)
  //    Los partidos de bracket tienen zona_id = null pero sí tienen categoria_id implícito via configuracion_llave
  //    Primero eliminamos configuracion_llave de la categoría completa (excepto los de zonas conservadas)
  //    En realidad, los partidos de bracket no tienen zona_id, se identifican por fase_bracket != null
  //    Si el usuario solo quiere limpiar zonas que no son A y B, los partidos de eliminatorias
  //    que ya hacen referencia a jugadores de esas zonas también deben limpiarse.
  
  // Obtener partidos de bracket (fase_bracket != null) de la categoría
  // Necesitamos el torneo_id - lo sacamos de las zonas
  const { data: zonaRef } = await supabase
    .from('zonas')
    .select('torneo_id')
    .eq('categoria_id', CATEGORIA_ID)
    .limit(1)
    .single();
  
  const torneoId = zonaRef?.torneo_id;
  console.log('\n[2/4] Eliminando partidos de bracket de la categoría...');
  
  if (torneoId) {
    const { data: bracketEliminados, error: errBracket } = await supabase
      .from('partidos')
      .delete()
      .eq('torneo_id', torneoId)
      .not('fase_bracket', 'is', null)
      .select('id');
    if (errBracket) { console.error('Error bracket:', errBracket); }
    else console.log(`  -> ${bracketEliminados?.length ?? 0} partidos de bracket eliminados.`);

    // 4. Eliminar configuracion_llave de la categoría
    console.log('\n[3/4] Eliminando configuracion_llave de la categoría...');
    const { data: configEliminada, error: errConfig } = await supabase
      .from('configuracion_llave')
      .delete()
      .eq('torneo_id', torneoId)
      .eq('categoria_id', CATEGORIA_ID)
      .select('id');
    if (errConfig) { console.error('Error config_llave:', errConfig); }
    else console.log(`  -> ${configEliminada?.length ?? 0} configuraciones de llave eliminadas.`);
  }

  // 5. Eliminar zonas (ON DELETE CASCADE elimina participantes_zonas automáticamente)
  console.log('\n[4/4] Eliminando zonas y sus participantes_zonas (CASCADE)...');
  const { data: zonasEliminadas, error: errZonasDel } = await supabase
    .from('zonas')
    .delete()
    .in('id', idsZonasAEliminar)
    .select('id, nombre');
  if (errZonasDel) { console.error('Error eliminando zonas:', errZonasDel); process.exit(1); }
  console.log(`  -> ${zonasEliminadas?.length ?? 0} zonas eliminadas:`, zonasEliminadas?.map(z => z.nombre));

  console.log('\n✅ Limpieza completada. Se conservaron Zona A y Zona B.');
}

cleanup().catch(console.error);
