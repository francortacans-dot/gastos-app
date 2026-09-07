# Reporte de sectores por mes/año + Ahorro en el reparto — Diseño

Fecha: 2026-09-07

## Propósito

Segunda de cuatro piezas independientes (la primera, gastos editables + feed
unificado, ya tiene spec y plan aparte). Extiende `app/(tabs)/historial.tsx`
(que hoy solo muestra un mes a la vez) para poder ver el gasto por sector
agregado por año completo, comparar mes a mes en una tabla, y que el "Ahorro"
del período aparezca como una porción más del reparto — no solo gastos —
tanto en la vista mensual existente como en la anual nueva.

## 1. Dominio: nuevas funciones puras en `src/domain/budget.ts`

Se agregan, sin modificar ninguna función existente:

```ts
export type YearKey = string; // 'YYYY'

/** Igual que gastadoPorSector, pero sumando los 12 meses del año (mismo criterio:
 * no filtra por fuente, un gasto pagado con ahorro también cuenta para su sector). */
export function gastadoPorSectorEnAnio(gastos: Expense[], anio: YearKey): Map<string, number>

/** Suma de los aportes con origen 'ingresos' fechados en `anio` — generaliza a
 * año la misma lógica que ya usa `mandadoAAhorroEnMes` (que se exporta, hoy es
 * privada del módulo) para el disponible mensual. */
export function mandadoAAhorroEnAnio(movimientos: SavingMovement[], anio: YearKey): number

/** Gasto por sector mes a mes dentro de un año: sectorId (o SIN_SECTOR) -> array
 * de 12 números (enero..diciembre), en centavos ARS. Reutiliza gastadoPorSector
 * por cada uno de los 12 meses del año. */
export function tablaSectorPorMes(gastos: Expense[], anio: YearKey): Map<string, number[]>
```

`mandadoAAhorroEnMes` (hoy `function` privada sin `export`) pasa a exportarse,
sin cambiar su firma ni comportamiento — la usa el modo Mes (sección 3).

## 2. UI: toggle Mes / Año en Historial

Arriba del `SelectorFecha` actual, un toggle de dos botones (mismo estilo
`grupoChip`/`chip`/`chipActivo` que ya usan Inicio e Inversiones para sus
toggles ARS/USD). Estado nuevo `const [vista, setVista] = useState<'mes' | 'anio'>('mes')`.

- **`vista === 'mes'`**: exactamente la pantalla de hoy (selector de
  fecha/día, tarjeta de presupuesto/gastado, tendencia de 6 meses, lista de
  gastos del día/mes), con un solo cambio: la porción "Ahorro" se agrega al
  array `porciones` del `PieChart` (ver sección 3).
- **`vista === 'anio'`**: reemplaza todo el contenido de abajo por:
  - Selector de año simple (`‹ 2026 ›`, mismo patrón de flechas que ya usa
    `SelectorFecha` para meses, pero solo con el año — no hace falta un
    componente nuevo complejo, dos `Pressable` con `IconArrowLeft`/`IconArrowRight`
    a los costados de un `Text` con el año).
  - `PieChart` con las porciones anuales: cada sector (`gastadoPorSectorEnAnio`)
    + una porción "Ahorro" (`mandadoAAhorroEnAnio`), mismo criterio de color
    que ya usan los sectores (su `color`) y un color fijo para "Ahorro"
    (`colors.blue`, ya usado como acento genérico en la paleta).
  - Tabla `sector × mes`: una fila por sector con gasto > 0 en el año
    (`tablaSectorPorMes`), con las 12 columnas Ene-Dic. Envuelta en un
    `ScrollView horizontal` (ancho fijo por columna, ej. 64px, para que
    entren los 12 meses con scroll lateral en vez de achicarse hasta ser
    ilegible). Los sectores sin nombre coinciden por `sectorId` con
    `useSectores()`; la fila de `SIN_SECTOR` (si tiene datos) se muestra
    como "Sin sector".

## 3. Ahorro como porción del reparto (modo Mes existente)

En el `porciones` que ya arma `historial.tsx` para el `PieChart` del modo
mes:

```ts
const gastoPorSector = gastadoPorSector(gastos, mes);
const porciones = [
  ...sectores
    .map((s) => ({ etiqueta: s.nombre, valor: gastoPorSector.get(s.id) ?? 0, color: s.color }))
    .filter((p) => p.valor > 0),
  { etiqueta: 'Ahorro', valor: mandadoAAhorroEnMes(movimientos, mes), color: colors.blue },
].filter((p) => p.valor > 0);
```

(`movimientos` ya está disponible en el componente vía `useAhorros()`, usado
hoy para `borrarGasto`.)

## Fuera de alcance

- Autoasignar sector según historial de gastos — spec aparte (pieza C).
- Exportar Inversiones a xlsx — spec aparte (pieza D).
- Comparar años entre sí (ej. 2025 vs 2026 lado a lado) — no pedido.
- Editar o filtrar la tabla `sector × mes` (ej. ordenar por columna) — es de
  solo lectura.
