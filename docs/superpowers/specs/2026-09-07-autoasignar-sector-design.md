# Autoasignar sector según historial de gastos — Diseño

Fecha: 2026-09-07

## Propósito

Tercera de cuatro piezas independientes. Cuando cargás (o editás) un gasto y
tipeás un "Lugar" que ya usaste antes, la app selecciona sola el sector que
le pusiste esa vez (el más frecuente si usaste varios), sin obligarte a
tipear el sector cada vez. Siempre podés tocar otro chip para cambiarlo antes
de guardar — nunca se fuerza ni se bloquea la selección manual.

## 1. Dominio: `sugerirSectorIdPorLugar`

Nuevo archivo `src/domain/sector-por-lugar.ts` (nombre distinto de
`src/domain/sectores-sugeridos.ts`, que ya existe y es un concepto no
relacionado: una lista estática de nombres de sector para el botón
"Sugeridos" de la pantalla Sectores).

```ts
import type { Expense } from './types';

/**
 * Busca gastos anteriores con el mismo "Lugar" (comparación exacta,
 * sin importar mayúsculas/espacios al principio o final) que ya tengan un
 * sector asignado, y devuelve el sector más frecuente entre esas coincidencias
 * (empate: el de la coincidencia más reciente por fecha). null si no hay
 * ninguna coincidencia o el lugar está vacío.
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
    conteos.set(g.sectorId as string, (conteos.get(g.sectorId as string) ?? 0) + 1);
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
```

## 2. UI: `app/gasto-nuevo.tsx`

En el `onChangeText` del `TextInput` de "Lugar" (después de que exista el
modo edición de la pieza A — este archivo ya tendrá `useGastos()` importado
por esa pieza):

```ts
<TextInput
  value={lugar}
  onChangeText={(t) => {
    setLugar(t);
    const sectorSugerido = sugerirSectorIdPorLugar(gastos, t);
    if (sectorSugerido) setSectorId(sectorSugerido);
  }}
  style={estilos.inputTexto}
  placeholder="Ej: Supermercado"
/>
```

Solo actúa mientras el usuario tipea (no en el `useState` inicial, así que
al abrir el formulario para editar un gasto existente no pisa el sector ya
guardado). Como la comparación es exacta, mientras el texto no matchee del
todo (ej. "Carre", "Carrefour Pal...") no dispara nada — recién al completar
el texto exacto de un lugar ya usado se autoselecciona. Si el usuario cambia
el chip a mano después de esto, esa elección manual queda: la función solo
vuelve a disparar si el texto de "Lugar" cambia de nuevo y vuelve a matchear
exactamente (no hay un flag de "no volver a sugerir en esta carga" — no
pedido, caso raro).

## Fuera de alcance

- Coincidencia difusa/parecida (ej. "Carrefour Palermo" ≈ "Carrefour") — se
  eligió comparación exacta.
- Aprender de "Descripción" además de "Lugar" — no pedido.
- Deshacer la autoasignación con un botón dedicado — alcanza con tocar otro
  chip.
