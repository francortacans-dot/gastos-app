# Reporte de sectores por mes/año — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Este plan asume que el plan `2026-09-07-gastos-editables.md` (Task 3: modo edición en `gasto-nuevo.tsx` + tap-to-edit en `historial.tsx`) ya se ejecutó** — el Task 2 de este plan reemplaza `app/(tabs)/historial.tsx` completo, e incluye ese cambio de tap-to-edit ya incorporado.

**Goal:** Agregar un toggle Mes/Año en Historial: en modo Año, gráfico de torta + tabla sector×mes de todo el año; en ambos modos (mes y año), "Ahorro" aparece como una porción más del reparto junto a los sectores.

**Architecture:** Tres funciones puras nuevas en `src/domain/budget.ts` (mismo módulo que ya centraliza todos los cálculos de presupuesto/sectores/ahorro), consumidas directamente por `historial.tsx` sin repos ni hooks nuevos — todos los datos ya están disponibles vía `useGastos()`/`useAhorros()`/`useSectores()`.

**Tech Stack:** TypeScript, React Native, Jest (sin dependencias nuevas).

## Global Constraints

- **Moneda canónica: ARS en centavos enteros.**
- **Comentarios en español.** camelCase/kebab-case/PascalCase.
- **TDD** para `src/domain/budget.ts` (lógica pura). Sin tests automáticos para `historial.tsx` (pantalla) — verificar con `npx tsc --noEmit`.
- **No se modifica el comportamiento de ninguna función existente en `budget.ts`** — solo se agregan 3 funciones nuevas y se exporta una que ya existía privada (`mandadoAAhorroEnMes`), sin tocar su cuerpo.
- **Colores**: exclusivamente `useColors()`/`Colors` (`src/theme/theme-context.tsx` + `src/theme/palettes.ts`).
- **Commits en español, descriptivos, en imperativo.**

---

## Task 1: Funciones de dominio para el reporte anual

**Files:**
- Modify: `src/domain/budget.ts`
- Modify: `src/domain/__tests__/budget.test.ts`

**Interfaces:**
- Consumes: `Expense`, `SavingMovement`, `MonthKey` de `src/domain/types.ts` (ya existen); `gastadoPorSector` (ya existe en el mismo archivo, sin cambios)
- Produces:
  - `type YearKey = string` (formato `'YYYY'`)
  - `function gastadoPorSectorEnAnio(gastos: Expense[], anio: YearKey): Map<string, number>`
  - `function mandadoAAhorroEnAnio(movimientos: SavingMovement[], anio: YearKey): number`
  - `function tablaSectorPorMes(gastos: Expense[], anio: YearKey): Map<string, number[]>`
  - `function mandadoAAhorroEnMes(movimientos: SavingMovement[], mes: MonthKey): number` — ya existe, pasa de privada (sin `export`) a exportada, sin cambiar su cuerpo.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/domain/__tests__/budget.test.ts` (el archivo ya importa `gasto`/`movimiento` como helpers y `Expense`/`SavingMovement` — reusarlos):

```typescript
import {
  gastadoPorSectorEnAnio,
  mandadoAAhorroEnAnio,
  tablaSectorPorMes,
  mandadoAAhorroEnMes,
} from '../budget';

describe('gastadoPorSectorEnAnio', () => {
  it('suma el gasto de cada sector a lo largo de los 12 meses del año, ignorando otros años', () => {
    const gastos = [
      gasto({ id: 'a', centavosArs: 1000, sectorId: 'ocio', fecha: '2026-01-05' }),
      gasto({ id: 'b', centavosArs: 500, sectorId: 'ocio', fecha: '2026-11-06' }),
      gasto({ id: 'c', centavosArs: 2000, sectorId: 'vacaciones', fecha: '2026-06-07' }),
      gasto({ id: 'd', centavosArs: 9999, sectorId: 'ocio', fecha: '2025-12-01' }),
    ];
    const resultado = gastadoPorSectorEnAnio(gastos, '2026');
    expect(resultado.get('ocio')).toBe(1500);
    expect(resultado.get('vacaciones')).toBe(2000);
  });

  it('no filtra por fuente: un gasto pagado con ahorro también cuenta para su sector', () => {
    const gastos = [gasto({ centavosArs: 700, sectorId: 'ocio', fecha: '2026-03-01', fuente: 'ahorro' })];
    const resultado = gastadoPorSectorEnAnio(gastos, '2026');
    expect(resultado.get('ocio')).toBe(700);
  });

  it('devuelve un Map vacío sin gastos ese año', () => {
    expect(gastadoPorSectorEnAnio([], '2026').size).toBe(0);
  });
});

describe('mandadoAAhorroEnAnio', () => {
  it('suma los aportes con origen "ingresos" fechados en el año, ignorando otros años y otros orígenes', () => {
    const movimientos = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-02-01', origen: 'ingresos' }),
      movimiento({ id: 'm2', centavosArs: 3000, fecha: '2026-09-15', origen: 'ingresos' }),
      movimiento({ id: 'm3', centavosArs: 1000, fecha: '2025-12-31', origen: 'ingresos' }),
      movimiento({ id: 'm4', centavosArs: 2000, fecha: '2026-05-01', origen: 'externo' }),
      movimiento({ id: 'm5', centavosArs: -500, fecha: '2026-05-01', origen: null, destino: 'disponible' }),
    ];
    expect(mandadoAAhorroEnAnio(movimientos, '2026')).toBe(8000);
  });

  it('devuelve 0 sin movimientos ese año', () => {
    expect(mandadoAAhorroEnAnio([], '2026')).toBe(0);
  });
});

describe('tablaSectorPorMes', () => {
  it('devuelve un array de 12 posiciones (enero..diciembre) por sector', () => {
    const gastos = [
      gasto({ id: 'a', centavosArs: 1000, sectorId: 'ocio', fecha: '2026-01-10' }),
      gasto({ id: 'b', centavosArs: 500, sectorId: 'ocio', fecha: '2026-03-10' }),
      gasto({ id: 'c', centavosArs: 2000, sectorId: 'vacaciones', fecha: '2026-12-01' }),
    ];
    const tabla = tablaSectorPorMes(gastos, '2026');

    expect(tabla.get('ocio')).toEqual([1000, 0, 500, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(tabla.get('vacaciones')).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2000]);
  });

  it('devuelve un Map vacío sin gastos ese año', () => {
    expect(tablaSectorPorMes([], '2026').size).toBe(0);
  });
});

describe('mandadoAAhorroEnMes (ahora exportada)', () => {
  it('sigue devolviendo lo mismo que antes: aportes con origen ingresos de ese mes exacto', () => {
    const movimientos = [
      movimiento({ id: 'm1', centavosArs: 4000, fecha: '2026-06-10', origen: 'ingresos' }),
      movimiento({ id: 'm2', centavosArs: 1000, fecha: '2026-05-10', origen: 'ingresos' }),
    ];
    expect(mandadoAAhorroEnMes(movimientos, '2026-06')).toBe(4000);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx jest budget`
Expected: FAIL — `gastadoPorSectorEnAnio`/`mandadoAAhorroEnAnio`/`tablaSectorPorMes`/`mandadoAAhorroEnMes` no exportados desde `'../budget'`.

- [ ] **Step 3: Exportar `mandadoAAhorroEnMes` y agregar las 3 funciones nuevas**

Cambiar la línea (dentro de `src/domain/budget.ts`):

```typescript
/** Suma de los aportes con origen 'ingresos' (salidos del presupuesto) fechados exactamente en `mes`. */
function mandadoAAhorroEnMes(movimientos: SavingMovement[], mes: MonthKey): number {
```

a:

```typescript
/** Suma de los aportes con origen 'ingresos' (salidos del presupuesto) fechados exactamente en `mes`. */
export function mandadoAAhorroEnMes(movimientos: SavingMovement[], mes: MonthKey): number {
```

Agregar al final del archivo (después de `calcularResumenMes`):

```typescript
export type YearKey = string;

function anioDeFecha(fechaIso: string): YearKey {
  return fechaIso.slice(0, 4);
}

/** Igual que gastadoPorSector, pero sumando los 12 meses del año en vez de un mes. */
export function gastadoPorSectorEnAnio(gastos: Expense[], anio: YearKey): Map<string, number> {
  const resultado = new Map<string, number>();
  for (const g of gastos) {
    if (anioDeFecha(g.fecha) !== anio) continue;
    const clave = g.sectorId ?? SIN_SECTOR;
    resultado.set(clave, (resultado.get(clave) ?? 0) + g.centavosArs);
  }
  return resultado;
}

/** Suma de los aportes con origen 'ingresos' fechados en `anio` (mismo criterio que mandadoAAhorroEnMes, para el año completo). */
export function mandadoAAhorroEnAnio(movimientos: SavingMovement[], anio: YearKey): number {
  return movimientos
    .filter((m) => m.centavosArs > 0 && origenEfectivo(m) === 'ingresos' && anioDeFecha(m.fecha) === anio)
    .reduce((acc, m) => acc + m.centavosArs, 0);
}

/** Gasto por sector, mes a mes, para un año completo: sectorId (o SIN_SECTOR) -> array de 12 números (enero..diciembre), en centavos ARS. */
export function tablaSectorPorMes(gastos: Expense[], anio: YearKey): Map<string, number[]> {
  const resultado = new Map<string, number[]>();
  for (let mesNum = 1; mesNum <= 12; mesNum++) {
    const mes = `${anio}-${String(mesNum).padStart(2, '0')}`;
    const porSector = gastadoPorSector(gastos, mes);
    for (const [sectorId, monto] of porSector) {
      const fila = resultado.get(sectorId) ?? new Array(12).fill(0);
      fila[mesNum - 1] = monto;
      resultado.set(sectorId, fila);
    }
  }
  return resultado;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx jest budget`
Expected: PASS — todos los tests de budget pasan (los existentes + los nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/domain/budget.ts src/domain/__tests__/budget.test.ts
git commit -m "agrega funciones de dominio para el reporte de sectores por año"
```

---

## Task 2: Toggle Mes/Año en Historial

**Files:**
- Modify: `app/(tabs)/historial.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: `gastadoPorSectorEnAnio`, `mandadoAAhorroEnAnio`, `tablaSectorPorMes`, `mandadoAAhorroEnMes` (Task 1); `useGastos`, `useAhorros`, `useSectores` (ya existen); `IconArrowLeft`, `IconArrowRight` (ya existen en `src/components/icons.tsx`)
- Produces: nada nuevo — pantalla terminal de este plan.

No hay tests automáticos de pantallas en este repo — verificar con `npx tsc --noEmit`.

**Nota:** este reemplazo completo ya incluye el cambio de tap-to-edit del plan `2026-09-07-gastos-editables.md` (Task 3: fila de gasto navega a `/gasto-nuevo?id=...`). Si por algún motivo ese plan todavía no se ejecutó, este Task 2 lo deja aplicado igual.

- [ ] **Step 1: Reemplazar `app/(tabs)/historial.tsx` completo**

```tsx
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, FlatList, StyleSheet } from 'react-native';
import { PantallaAnimada } from '../../src/components/pantalla-animada';
import { Toast } from '../../src/components/toast';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/app-context';
import { useMesActual } from '../../src/hooks/use-mes-actual';
import { useResumenMes } from '../../src/hooks/use-resumen-mes';
import { useSectores, useGastos, useAhorros } from '../../src/hooks/use-datos';
import { eliminarGasto } from '../../src/repos/eliminar-gasto';
import {
  gastadoPorSector,
  gastadoEnMes,
  mesAnterior,
  mandadoAAhorroEnMes,
  gastadoPorSectorEnAnio,
  mandadoAAhorroEnAnio,
  tablaSectorPorMes,
} from '../../src/domain/budget';
import { PieChart } from '../../src/components/pie-chart';
import { BarChart, type BarraDato } from '../../src/components/bar-chart';
import { SelectorFecha } from '../../src/components/selector-fecha';
import { MoneyText } from '../../src/components/money-text';
import { IconTrash, IconArrowLeft, IconArrowRight } from '../../src/components/icons';
import { formatCentavos } from '../../src/domain/money';
import { useColors } from '../../src/theme/theme-context';
import type { Colors } from '../../src/theme/palettes';
import { spacing } from '../../src/theme/spacing';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function etiquetaCortaDeMes(mesClave: string): string {
  const [anio, mesNum] = mesClave.split('-').map(Number);
  const texto = new Date(anio, mesNum - 1, 1).toLocaleDateString('es-AR', { month: 'short' });
  return texto.charAt(0).toUpperCase() + texto.slice(1).replace('.', '');
}

export default function Historial() {
  const router = useRouter();
  const { repos } = useApp();
  const { mes, irAMes } = useMesActual();
  const resumen = useResumenMes(mes);
  const sectores = useSectores();
  const gastos = useGastos();
  const movimientos = useAhorros();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);
  const [vista, setVista] = useState<'mes' | 'anio'>('mes');
  const [anioSeleccionado, setAnioSeleccionado] = useState(() => Number(mes.split('-')[0]));

  const tendencia: BarraDato[] = useMemo(() => {
    const meses: string[] = [mes];
    for (let i = 0; i < 5; i++) meses.unshift(mesAnterior(meses[0]));
    return meses.map((m) => ({
      etiqueta: etiquetaCortaDeMes(m),
      valor: gastadoEnMes(gastos, m),
      destacada: m === mes,
    }));
  }, [gastos, mes]);

  const gastoPorSector = gastadoPorSector(gastos, mes);
  const porciones = [
    ...sectores
      .map((s) => ({ etiqueta: s.nombre, valor: gastoPorSector.get(s.id) ?? 0, color: s.color }))
      .filter((p) => p.valor > 0),
    { etiqueta: 'Ahorro', valor: mandadoAAhorroEnMes(movimientos, mes), color: colors.blue },
  ].filter((p) => p.valor > 0);

  const gastosDelMes = gastos
    .filter((g) => g.fecha.slice(0, 7) === mes)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const fechasConGasto = new Set(gastosDelMes.map((g) => g.fecha));
  const gastosAMostrar = diaSeleccionado ? gastosDelMes.filter((g) => g.fecha === diaSeleccionado) : gastosDelMes;

  const anioKey = String(anioSeleccionado);
  const gastoPorSectorAnio = gastadoPorSectorEnAnio(gastos, anioKey);
  const porcionesAnio = [
    ...sectores
      .map((s) => ({ etiqueta: s.nombre, valor: gastoPorSectorAnio.get(s.id) ?? 0, color: s.color }))
      .filter((p) => p.valor > 0),
    { etiqueta: 'Ahorro', valor: mandadoAAhorroEnAnio(movimientos, anioKey), color: colors.blue },
  ].filter((p) => p.valor > 0);
  const tablaAnio = tablaSectorPorMes(gastos, anioKey);
  const filasTabla = sectores
    .filter((s) => (tablaAnio.get(s.id) ?? []).some((v) => v > 0))
    .map((s) => ({ nombre: s.nombre, valores: tablaAnio.get(s.id) ?? new Array(12).fill(0) }));

  async function borrarGasto(gasto: (typeof gastos)[number]) {
    setErrorBorrado(null);
    try {
      await eliminarGasto(repos, gasto, movimientos);
    } catch {
      setErrorBorrado('No se pudo borrar el gasto. Probá de nuevo.');
    }
  }

  return (
    <PantallaAnimada>
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      <View style={estilos.grupoChip}>
        {(['mes', 'anio'] as const).map((v) => (
          <Pressable key={v} onPress={() => setVista(v)} style={[estilos.chip, vista === v && estilos.chipActivo]}>
            <Text style={[estilos.textoChip, vista === v && estilos.textoChipActivo]}>
              {v === 'mes' ? 'Mes' : 'Año'}
            </Text>
          </Pressable>
        ))}
      </View>

      {vista === 'mes' ? (
        <>
          <SelectorFecha
            mes={mes}
            onMesChange={irAMes}
            diaSeleccionado={diaSeleccionado}
            onDiaChange={setDiaSeleccionado}
            fechasConGasto={fechasConGasto}
          />

          <View style={estilos.tarjetaResumen}>
            <Text style={estilos.etiqueta}>Presupuesto</Text>
            <MoneyText centavos={resumen.presupuestoDelMes} moneda="ARS" style={estilos.monto} />
            <Text style={estilos.etiqueta}>Gastado</Text>
            <MoneyText centavos={resumen.gastado} moneda="ARS" style={estilos.monto} />
          </View>

          <View style={estilos.tarjetaTendencia}>
            <Text style={estilos.tituloTendencia}>Últimos 6 meses</Text>
            <BarChart datos={tendencia} />
          </View>

          {porciones.length > 0 && !diaSeleccionado && (
            <View style={estilos.centrado}>
              <PieChart porciones={porciones} size={180} />
            </View>
          )}

          {diaSeleccionado && (
            <Pressable onPress={() => setDiaSeleccionado(null)} style={estilos.filaTituloLista}>
              <Text style={estilos.limpiarFiltro}>Ver todo el mes</Text>
            </Pressable>
          )}

          <Toast texto={errorBorrado} tipo="error" colors={colors} />

          <FlatList
            data={gastosAMostrar}
            keyExtractor={(g) => g.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={estilos.filaGasto}>
                <Pressable style={estilos.infoGasto} onPress={() => router.push(`/gasto-nuevo?id=${item.id}`)}>
                  <Text style={estilos.descripcionGasto}>{item.descripcion ?? item.lugar ?? 'Gasto sin descripción'}</Text>
                  <Text style={estilos.fechaGasto}>{item.fecha}</Text>
                  {(item.fuente ?? 'disponible') === 'ahorro' && (
                    <Text style={estilos.etiquetaAhorro}>Pagado con ahorro</Text>
                  )}
                </Pressable>
                <Text style={estilos.montoGasto}>{formatCentavos(item.centavosArs)}</Text>
                <Pressable onPress={() => borrarGasto(item)} hitSlop={8} style={estilos.botonBorrar}>
                  <IconTrash color={colors.text4} size={16} />
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              <Text style={estilos.vacio}>{diaSeleccionado ? 'Sin gastos ese día.' : 'Sin gastos este mes.'}</Text>
            }
          />
        </>
      ) : (
        <>
          <View style={estilos.filaAnio}>
            <Pressable onPress={() => setAnioSeleccionado((a) => a - 1)} hitSlop={8}>
              <IconArrowLeft color={colors.text2} size={20} />
            </Pressable>
            <Text style={estilos.textoAnio}>{anioSeleccionado}</Text>
            <Pressable onPress={() => setAnioSeleccionado((a) => a + 1)} hitSlop={8}>
              <IconArrowRight color={colors.text2} size={20} />
            </Pressable>
          </View>

          {porcionesAnio.length > 0 && (
            <View style={estilos.centrado}>
              <PieChart porciones={porcionesAnio} size={200} />
            </View>
          )}

          {filasTabla.length === 0 ? (
            <Text style={estilos.vacio}>Sin gastos en {anioSeleccionado}.</Text>
          ) : (
            <ScrollView horizontal contentContainerStyle={estilos.tablaContenido}>
              <View>
                <View style={estilos.filaTabla}>
                  <Text style={[estilos.celdaTablaEncabezado, estilos.celdaTablaSector]}>Sector</Text>
                  {MESES_CORTOS.map((m) => (
                    <Text key={m} style={estilos.celdaTablaEncabezado}>
                      {m}
                    </Text>
                  ))}
                </View>
                {filasTabla.map((fila) => (
                  <View key={fila.nombre} style={estilos.filaTabla}>
                    <Text style={[estilos.celdaTablaSector, estilos.celdaTablaTexto]} numberOfLines={1}>
                      {fila.nombre}
                    </Text>
                    {fila.valores.map((valor, i) => (
                      <Text key={i} style={estilos.celdaTablaTexto}>
                        {valor > 0 ? formatCentavos(valor) : '—'}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </>
      )}
    </ScrollView>
    </PantallaAnimada>
  );
}

function crearEstilos(colors: Colors) {
  const sombra = { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as const;

  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg },
    contenido: { padding: spacing.md },
    grupoChip: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 20, padding: 3, alignSelf: 'flex-start', marginBottom: spacing.sm },
    chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 17 },
    chipActivo: { backgroundColor: colors.primary },
    textoChip: { color: colors.text3, fontWeight: '600', fontSize: 13 },
    textoChipActivo: { color: colors.onPrimary },
    tarjetaResumen: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, marginBottom: spacing.md, ...sombra },
    etiqueta: { color: colors.text3, marginTop: spacing.xs },
    monto: { fontSize: 20, fontWeight: '700', color: colors.text1 },
    tarjetaTendencia: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, marginBottom: spacing.md, ...sombra },
    tituloTendencia: { color: colors.text2, fontWeight: '700', fontSize: 14, marginBottom: spacing.sm },
    centrado: { alignItems: 'center', marginBottom: spacing.md },
    filaTituloLista: { marginBottom: spacing.sm },
    limpiarFiltro: { color: colors.primary, fontWeight: '600', fontSize: 13 },
    filaGasto: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.xs, gap: spacing.xs },
    infoGasto: { flex: 1 },
    descripcionGasto: { color: colors.text1, fontWeight: '600' },
    fechaGasto: { color: colors.text3, fontSize: 12 },
    etiquetaAhorro: { color: colors.text3, fontSize: 11 },
    montoGasto: { color: colors.text1, fontWeight: '700' },
    botonBorrar: { padding: 4 },
    vacio: { color: colors.text3, textAlign: 'center', marginTop: spacing.md },
    filaAnio: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: spacing.md },
    textoAnio: { color: colors.text1, fontWeight: '700', fontSize: 18, minWidth: 60, textAlign: 'center' },
    tablaContenido: { paddingBottom: spacing.md },
    filaTabla: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
    celdaTablaEncabezado: { width: 64, textAlign: 'center', color: colors.text3, fontWeight: '700', fontSize: 11, paddingVertical: spacing.xs },
    celdaTablaSector: { width: 110, textAlign: 'left', paddingLeft: spacing.xs },
    celdaTablaTexto: { width: 64, textAlign: 'center', color: colors.text1, fontSize: 11, paddingVertical: spacing.xs },
  });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: la misma línea base de errores preexistentes de siempre (`getReactNativePersistence` + 10× `global` en `dolar.test.ts`), nada nuevo.

- [ ] **Step 3: Correr la suite completa**

Run: `npm test`
Expected: PASS — todos los tests, incluidos los de la Task 1.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/historial.tsx"
git commit -m "agrega toggle mes/año en Historial con tabla sector×mes y ahorro en el reparto"
```
