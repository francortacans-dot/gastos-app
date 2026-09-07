# Gastos editables + feed unificado de movimientos — Diseño

Fecha: 2026-09-07

## Propósito

Primera de cuatro piezas independientes pedidas por el usuario (las otras tres —
reporte de sectores por mes/año con Ahorro incluido, autoasignación de sector por
historial, y exportar Inversiones a xlsx— quedan para specs separadas). Esta cubre:

1. Poder editar un gasto ya cargado (hoy solo se puede borrar y recargar).
2. Que la edición mantenga consistente el movimiento de ahorro vinculado, cuando
   el gasto se pagó (o pasa a pagarse) con `fuente: 'ahorro'`.
3. Reemplazar la sección "Últimos gastos" de Inicio por un feed que mezcla gastos,
   movimientos de ahorro e inversiones (altas y ventas), no solo gastos.

## 1. Editar un gasto

`app/gasto-nuevo.tsx` pasa a soportar un modo edición, siguiendo el mismo patrón
que ya usan `app/sector-nuevo.tsx` y `app/objetivo-nuevo.tsx`:

- La pantalla acepta un parámetro opcional `?id=<expenseId>` vía
  `useLocalSearchParams<{ id?: string }>()`.
- Si `id` está presente y matchea un gasto de `useGastos()`, precarga todos los
  campos del formulario (monto, sector, lugar, descripción, método de pago,
  fuente) con los valores actuales del gasto.
- El título del `BottomSheet` y el texto del botón cambian según el modo
  (`'Nuevo gasto'`/`'Guardar gasto'` vs. `'Editar gasto'`/`'Guardar cambios'`).
- Se agrega un botón "Borrar gasto" debajo del de guardar, visible solo en modo
  edición, que reutiliza `eliminarGasto` (ya existe, sin cambios).

**Nuevo método en `ExpenseRepo`:** `guardar(gasto: Expense): Promise<Expense>` —
reemplazo completo por id, mismo patrón de upsert que ya usan `SectorRepo`,
`BudgetRepo` e `InvestmentRepo`: escribe el snapshot local como
mejor-esfuerzo (nunca condiciona la corrección de la escritura a Firestore a lo
que se leyó del store local, para funcionar igual en web —donde el store local
es un no-op— que en celular). `agregar`/`eliminar` no cambian.

**Puntos de entrada a la edición:** en `app/(tabs)/historial.tsx`, la fila de cada
gasto se envuelve en un `Pressable` que navega a `/gasto-nuevo?id=<id>` (el botón
de borrar existente se mantiene aparte, igual que en `sectores.tsx`). El feed
unificado de Inicio (sección 3) hace lo mismo para las entradas de tipo gasto.

## 2. Recalcular el movimiento de ahorro vinculado

Nueva función `editarGasto(repos, gastoActualizado, movimientosActuales)` en
`src/repos/editar-gasto.ts`, hermana de `pagarGasto` (`src/repos/pagar-gasto.ts`)
y `eliminarGasto` (`src/repos/eliminar-gasto.ts`):

```
1. Busca el SavingMovement vinculado actual (movimientosActuales.find(m => m.gastoId === gastoActualizado.id)).
2. Si existe, lo borra (repos.savings.eliminar).
3. Si la nueva fuente es 'ahorro':
   a. saldoBase = totalAhorrado(movimientosActuales) + (había vínculo ? -movimientoViejo.centavosArs : 0)
      (es decir, el saldo actual más lo que se libera al borrar el movimiento viejo)
   b. Si gastoActualizado.centavosArs > saldoBase, lanza error de saldo insuficiente
      (mismo mensaje que ya usa pagarGasto).
4. Guarda el gasto actualizado (repos.expenses.guardar).
5. Si la nueva fuente es 'ahorro', crea el SavingMovement nuevo
   (centavosArs: -gastoActualizado.centavosArs, gastoId: gastoActualizado.id,
   destino: 'gasto', misma nota que pagarGasto), en ese orden.
```

Cubre las 4 combinaciones posibles: fuente sigue en 'disponible' (no toca ahorro),
fuente sigue en 'ahorro' con el monto cambiado (borra+recrea con el monto nuevo),
pasa de 'disponible' a 'ahorro' (crea), pasa de 'ahorro' a 'disponible' (borra sin
crear). El orden borrar-antes-de-validar-saldo es intencional: si el usuario solo
cambió el monto de un gasto que ya pagaba con ahorro, ese ahorro liberado cuenta a
favor del nuevo monto, no en contra.

## 3. Feed unificado de "últimos movimientos" en Inicio

Reemplaza la sección `Últimos gastos` de `app/(tabs)/index.tsx` por una lista de
los últimos 8 movimientos, mezclando tres tipos de datos ya reactivos vía hooks
existentes (`useGastos`, `useAhorros`, `useInversiones` + `useVentas`):

```ts
type MovimientoFeed =
  | { tipo: 'gasto'; fecha: string; id: string; datos: Expense }
  | { tipo: 'ahorro'; fecha: string; id: string; datos: SavingMovement }
  | { tipo: 'inversion-alta'; fecha: string; id: string; datos: Investment }
  | { tipo: 'inversion-venta'; fecha: string; id: string; datos: InvestmentSale };
```

Nueva función pura `construirFeedMovimientos(gastos, ahorros, inversiones, ventas): MovimientoFeed[]`
en `src/domain/feed-movimientos.ts` (testeada con Jest, igual que el resto de
`src/domain`): concatena las 4 fuentes, ordena por `fecha` descendente, corta a
los primeros 8. Los envíos a ahorro que en realidad son el retiro vinculado a un
gasto pagado con ahorro (`destino === 'gasto'`) se excluyen del feed — ya
aparecen representados como la entrada de gasto correspondiente, listarlos aparte
sería duplicar la misma operación.

En la UI: cada tipo de entrada tiene su ícono (gasto: sin ícono propio, como hoy;
ahorro: `IconAhorro`; inversión alta/venta: el ícono nuevo de Inversiones) y su
línea de detalle (gasto: descripción/lugar + monto; ahorro: "Mandaste a ahorro" /
"Retiraste de ahorro" + monto; inversión alta: "Compraste `<nominales>` `<ticker>`";
venta: "Vendiste `<nominales>` `<ticker>`" + ganancia/pérdida en color). Solo las
entradas de tipo `'gasto'` son tocables (navegan a editar, igual que hoy); las
demás son informativas, sin acción al tocarlas.

## Fuera de alcance de esta pieza

- Reporte de sectores por mes/año y Ahorro como porción del reparto — spec
  aparte.
- Autoasignar sector según historial de gastos — spec aparte.
- Exportar Inversiones a xlsx — spec aparte.
- Editar movimientos de ahorro sueltos (los que no vienen de un gasto) o editar
  ventas de inversión ya registradas — no pedido, fuera de alcance.
