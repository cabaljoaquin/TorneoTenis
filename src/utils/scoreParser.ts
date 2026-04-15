interface SetResult {
  p1: number
  p2: number
}

/**
 * Parsea la entrada rápida de tenis asumiendo que los valores
 * representan el resultado de p1 y p2 secuencialmente.
 * Soporta ingreso del super-tiebreak a 10.
 *
 * Ej: "6467108" -> [{p1:6, p2:4}, {p1:6, p2:7}, {p1:10, p2:8}]
 */
export function parseTennisScore(input: string): any[] {
  const str = input.replace(/\D/g, '')
  if (str.length === 0) return []

  const sets: any[] = []
  let i = 0

  while (i < str.length) {
    const remaining = str.slice(i)

    // Evaluar Super-Tiebreak
    if (sets.length >= 2 && remaining.length >= 3) {
      if (remaining.startsWith('10') || remaining.startsWith('11') || remaining.startsWith('12')) {
        sets.push({ p1: parseInt(remaining.slice(0, 2)), p2: parseInt(remaining.slice(2, remaining.length === 3 ? 3 : 4)) })
        break
      } else if (remaining.endsWith('10') || remaining.endsWith('11') || remaining.endsWith('12')) {
        sets.push({ p1: parseInt(remaining.slice(0, 1)), p2: parseInt(remaining.slice(1)) })
        break
      }
    }

    if (i + 1 < str.length) {
      const p1 = parseInt(str[i], 10)
      const p2 = parseInt(str[i + 1], 10)

      // Heurística de Tie-Break:
      const lastSet = sets[sets.length - 1]
      const wasTiebreak = lastSet && ((lastSet.p1 === 7 && lastSet.p2 === 6) || (lastSet.p1 === 6 && lastSet.p2 === 7))
      
      if (wasTiebreak && lastSet.tb1 === undefined && lastSet.tb2 === undefined) {
         // Validamos si el (p1, p2) podría representar un tiebreak válido.
         // Un tiebreak estándar de 7 puntos se gana llegando a 7, o más si hay diferencia de 2.
         // Para máxima flexibilidad deportiva y compatibilidad con errores de carga, 
         // si tenemos un 76 previo, asumimos que los próximos dos dígitos CASI SIEMPRE son su score de tiebreak.
         const isTiebreakScore = 
            (p1 === 7 && p2 <= 5) || 
            (p2 === 7 && p1 <= 5) || 
            (p1 >= 6 && p2 >= 6 && Math.abs(p1 - p2) === 2) ||
            (p1 >= 8 || p2 >= 8) // ej 8-6, 10-8
            
         if (isTiebreakScore) {
           lastSet.tb1 = p1
           lastSet.tb2 = p2
           i += 2
           continue
         }
      }

      sets.push({ p1, p2 })
      i += 2
    } else {
      break
    }
  }

  return sets
}
