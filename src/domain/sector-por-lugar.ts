import type { Expense } from './types';

/**
 * Busca gastos anteriores con el mismo "Lugar" (comparación exacta, sin
 * importar mayúsculas ni espacios al principio/final) que ya tengan un
 * sector asignado, y devuelve el sector más frecuente entre esas
 * coincidencias (empate: el de la coincidencia más reciente por fecha).
 * null si no hay ninguna coincidencia o el lugar está vacío.
 */
export function sugerirSectorIdPorLugar(gastos: Expense[], lugar: string): string | null {
  const lugarNormalizado = lugar.trim().toLowerCase();
  if (!lugarNormalizado) return null;

  const coincidencias = gastos.filter(
    (g) => g.sectorId !== null && (g.lugar ?? '').trim().toLowerCase() === lugarNormalizado
  );
  if (coincidencias.length === 0) return null;

  const conteos = new Map<string, number>();
  for (const g of coincidencias) {
    const sectorId = g.sectorId as string;
    conteos.set(sectorId, (conteos.get(sectorId) ?? 0) + 1);
  }

  const masReciente = [...coincidencias].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  let mejorSector = masReciente.sectorId as string;
  let mejorConteo = conteos.get(mejorSector) as number;
  for (const [sectorId, conteo] of conteos) {
    if (conteo > mejorConteo) {
      mejorSector = sectorId;
      mejorConteo = conteo;
    }
  }
  return mejorSector;
}
