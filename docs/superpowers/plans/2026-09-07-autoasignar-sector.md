# Autoasignar sector según historial — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Este plan asume que el plan `2026-09-07-gastos-editables.md` (Task 3: modo edición en `gasto-nuevo.tsx`) ya se ejecutó** — el Task 2 de este plan reemplaza `app/gasto-nuevo.tsx` completo, e incluye ese modo edición ya incorporado.

**Goal:** Al tipear en "Lugar" un texto que ya usaste en un gasto anterior, autoseleccionar el sector que usaste esa vez (el más frecuente si usaste varios), sin bloquear que el usuario elija otro sector a mano.

**Architecture:** Una función de dominio pura (`sugerirSectorIdPorLugar`) consumida directamente desde el `onChangeText` del campo "Lugar" en `gasto-nuevo.tsx` — sin repos, hooks ni estado nuevo más allá de lo que ya existe.

**Tech Stack:** TypeScript, React Native, Jest (sin dependencias nuevas).

## Global Constraints

- **Comentarios en español.** camelCase/kebab-case/PascalCase.
- **TDD** para `src/domain/sector-por-lugar.ts`. Sin tests automáticos para `gasto-nuevo.tsx` (pantalla) — verificar con `npx tsc --noEmit`.
- **Comparación exacta de texto** (sin importar mayúsculas ni espacios al principio/final) — no coincidencia difusa.
- **Nunca bloquea la selección manual**: la sugerencia solo pre-marca un chip, el usuario puede tocar cualquier otro para cambiarlo.

---

## Task 1: `sugerirSectorIdPorLugar`

**Files:**
- Create: `src/domain/sector-por-lugar.ts`
- Create: `src/domain/__tests__/sector-por-lugar.test.ts`

**Interfaces:**
- Consumes: `Expense` de `src/domain/types.ts` (ya existe, sin cambios)
- Produces: `function sugerirSectorIdPorLugar(gastos: Expense[], lugar: string): string | null` — usado por Task 2.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/domain/__tests__/sector-por-lugar.test.ts`:

```typescript
import { sugerirSectorIdPorLugar } from '../sector-por-lugar';
import type { Expense } from '../types';

function gasto(parcial: Partial<Expense> = {}): Expense {
  return {
    id: 'g1',
    centavosArs: 1000,
    montoOriginal: 10,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    fecha: '2026-06-01',
    sectorId: null,
    lugar: null,
    descripcion: null,
    metodoPago: null,
    fuente: 'disponible',
    ...parcial,
  };
}

describe('sugerirSectorIdPorLugar', () => {
  it('sugiere el sector de la última vez que se usó ese lugar exacto', () => {
    const gastos = [gasto({ id: 'g1', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-05-01' })];
    expect(sugerirSectorIdPorLugar(gastos, 'Carrefour')).toBe('comida');
  });

  it('ignora mayúsculas/minúsculas y espacios al principio/final', () => {
    const gastos = [gasto({ id: 'g1', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-05-01' })];
    expect(sugerirSectorIdPorLugar(gastos, '  CARREFOUR  ')).toBe('comida');
  });

  it('con varios sectores usados para el mismo lugar, sugiere el más frecuente', () => {
    const gastos = [
      gasto({ id: 'g1', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-01-01' }),
      gasto({ id: 'g2', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-02-01' }),
      gasto({ id: 'g3', lugar: 'Carrefour', sectorId: 'limpieza', fecha: '2026-03-01' }),
    ];
    expect(sugerirSectorIdPorLugar(gastos, 'Carrefour')).toBe('comida');
  });

  it('en caso de empate, sugiere el de la coincidencia más reciente', () => {
    const gastos = [
      gasto({ id: 'g1', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-01-01' }),
      gasto({ id: 'g2', lugar: 'Carrefour', sectorId: 'limpieza', fecha: '2026-03-01' }),
    ];
    expect(sugerirSectorIdPorLugar(gastos, 'Carrefour')).toBe('limpieza');
  });

  it('ignora coincidencias sin sector asignado', () => {
    const gastos = [gasto({ id: 'g1', lugar: 'Carrefour', sectorId: null, fecha: '2026-01-01' })];
    expect(sugerirSectorIdPorLugar(gastos, 'Carrefour')).toBeNull();
  });

  it('no matchea lugares distintos ni parecidos (comparación exacta, no difusa)', () => {
    const gastos = [gasto({ id: 'g1', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-01-01' })];
    expect(sugerirSectorIdPorLugar(gastos, 'Carrefour Palermo')).toBeNull();
  });

  it('devuelve null si el lugar está vacío', () => {
    const gastos = [gasto({ id: 'g1', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-01-01' })];
    expect(sugerirSectorIdPorLugar(gastos, '  ')).toBeNull();
  });

  it('devuelve null sin ningún gasto', () => {
    expect(sugerirSectorIdPorLugar([], 'Carrefour')).toBeNull();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx jest sector-por-lugar`
Expected: FAIL — "Cannot find module '../sector-por-lugar'".

- [ ] **Step 3: Implementar `src/domain/sector-por-lugar.ts`**

```typescript
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
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx jest sector-por-lugar`
Expected: PASS — los 8 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add src/domain/sector-por-lugar.ts src/domain/__tests__/sector-por-lugar.test.ts
git commit -m "agrega función de dominio para sugerir sector según lugar"
```

---

## Task 2: Wiring en `gasto-nuevo.tsx`

**Files:**
- Modify: `app/gasto-nuevo.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: `sugerirSectorIdPorLugar` (Task 1); `useGastos` (ya existe, usado por el modo edición de la pieza A)
- Produces: nada nuevo — pantalla terminal de este plan.

No hay tests automáticos de pantallas — verificar con `npx tsc --noEmit`.

**Nota:** este reemplazo completo ya incluye el modo edición del plan `2026-09-07-gastos-editables.md` (Task 3). Si por algún motivo ese plan todavía no se ejecutó, este Task 2 lo deja aplicado igual.

- [ ] **Step 1: Reemplazar `app/gasto-nuevo.tsx` completo**

```tsx
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TextInputTema as TextInput } from '../src/components/text-input-tema';
import { Toast } from '../src/components/toast';
import { BottomSheet } from '../src/components/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../src/app-context';
import { useGastos, useSectores, useAhorros } from '../src/hooks/use-datos';
import { parseAmountToCentavos, formatCentavos } from '../src/domain/money';
import { totalAhorrado } from '../src/domain/budget';
import { pagarGasto } from '../src/repos/pagar-gasto';
import { editarGasto } from '../src/repos/editar-gasto';
import { eliminarGasto } from '../src/repos/eliminar-gasto';
import { sugerirSectorIdPorLugar } from '../src/domain/sector-por-lugar';
import { useColors } from '../src/theme/theme-context';
import type { Colors } from '../src/theme/palettes';
import { spacing } from '../src/theme/spacing';

const METODOS_SUGERIDOS: string[] = [
  'Efectivo',
  'Débito',
  'Crédito',
  'Transferencia',
  'Mercado Pago',
  'Brubank',
  'Ualá',
  'Naranja X',
];

export default function GastoNuevo() {
  const router = useRouter();
  const { repos } = useApp();
  const sectores = useSectores();
  const gastos = useGastos();
  const movimientos = useAhorros();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const { id } = useLocalSearchParams<{ id?: string }>();
  const gastoExistente = id ? gastos.find((g) => g.id === id) ?? null : null;
  const editando = gastoExistente !== null;

  const [montoTexto, setMontoTexto] = useState(
    gastoExistente ? String(gastoExistente.centavosArs / 100).replace('.', ',') : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [sectorId, setSectorId] = useState<string | null>(gastoExistente?.sectorId ?? null);
  const [lugar, setLugar] = useState(gastoExistente?.lugar ?? '');
  const [descripcion, setDescripcion] = useState(gastoExistente?.descripcion ?? '');
  const [metodoPago, setMetodoPago] = useState<string | null>(
    gastoExistente?.metodoPago && METODOS_SUGERIDOS.includes(gastoExistente.metodoPago) ? gastoExistente.metodoPago : null
  );
  const [metodoPersonalizado, setMetodoPersonalizado] = useState(
    gastoExistente?.metodoPago && !METODOS_SUGERIDOS.includes(gastoExistente.metodoPago) ? gastoExistente.metodoPago : ''
  );
  const [fuente, setFuente] = useState<'disponible' | 'ahorro'>(gastoExistente?.fuente ?? 'disponible');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const centavos = parseAmountToCentavos(montoTexto);
    if (centavos === null || centavos === 0) {
      setError('Ingresá un monto válido');
      return;
    }

    setGuardando(true);
    try {
      const datosGasto = {
        centavosArs: centavos,
        montoOriginal: centavos / 100,
        monedaOriginal: 'ARS' as const,
        cotizacionUsada: null,
        fecha: gastoExistente?.fecha ?? new Date().toISOString().slice(0, 10),
        sectorId,
        lugar: lugar.trim() || null,
        descripcion: descripcion.trim() || null,
        metodoPago: metodoPersonalizado.trim() || metodoPago,
        fuente,
      };

      if (gastoExistente) {
        await editarGasto(repos, { ...datosGasto, id: gastoExistente.id }, movimientos);
      } else {
        await pagarGasto(repos, datosGasto, movimientos);
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el gasto');
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!gastoExistente) return;
    try {
      await eliminarGasto(repos, gastoExistente, movimientos);
      router.back();
    } catch {
      setError('No se pudo borrar el gasto. Probá de nuevo.');
    }
  }

  return (
    <BottomSheet titulo={editando ? 'Editar gasto' : 'Nuevo gasto'} onCerrar={() => router.back()}>
      <TextInput
        value={montoTexto}
        onChangeText={(t) => {
          setMontoTexto(t);
          setError(null);
        }}
        placeholder="0,00"
        keyboardType="decimal-pad"
        style={estilos.inputMonto}
        autoFocus
      />
      <Toast texto={error} tipo="error" colors={colors} />

      <View style={estilos.opcionales}>
        <Text style={estilos.etiquetaCampo}>Fuente</Text>
        <View style={estilos.filaChips}>
          <Pressable
            onPress={() => {
              setFuente('disponible');
              setError(null);
            }}
            style={[estilos.chip, { borderColor: colors.border }, fuente === 'disponible' && { backgroundColor: colors.primary }]}
          >
            <Text style={[estilos.textoChip, fuente === 'disponible' && { color: colors.onPrimary }]}>Presupuesto</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setFuente('ahorro');
              setError(null);
            }}
            style={[estilos.chip, { borderColor: colors.border }, fuente === 'ahorro' && { backgroundColor: colors.primary }]}
          >
            <Text style={[estilos.textoChip, fuente === 'ahorro' && { color: colors.onPrimary }]}>Ahorro</Text>
          </Pressable>
        </View>
        {fuente === 'ahorro' && (
          <Text style={estilos.ayudaFuente}>Saldo de ahorro disponible: {formatCentavos(totalAhorrado(movimientos))}</Text>
        )}

        <Text style={estilos.etiquetaCampo}>Sector</Text>
        <View style={estilos.filaChips}>
          {sectores.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSectorId(sectorId === s.id ? null : s.id)}
              style={[estilos.chip, { borderColor: s.color }, sectorId === s.id && { backgroundColor: s.color }]}
            >
              <Text style={[estilos.textoChip, sectorId === s.id && { color: colors.onPrimary }]}>{s.nombre}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={estilos.etiquetaCampo}>Lugar</Text>
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

        <Text style={estilos.etiquetaCampo}>Descripción</Text>
        <TextInput value={descripcion} onChangeText={setDescripcion} style={estilos.inputTexto} placeholder="Ej: Compra del mes" />

        <Text style={estilos.etiquetaCampo}>Método de pago</Text>
        <View style={estilos.filaChips}>
          {METODOS_SUGERIDOS.map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                setMetodoPago(metodoPago === m ? null : m);
                setMetodoPersonalizado('');
              }}
              style={[estilos.chip, { borderColor: colors.border }, metodoPago === m && { backgroundColor: colors.primary }]}
            >
              <Text style={[estilos.textoChip, metodoPago === m && { color: colors.onPrimary }]}>{m}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={metodoPersonalizado}
          onChangeText={(t) => {
            setMetodoPersonalizado(t);
            if (t) setMetodoPago(null);
          }}
          style={estilos.inputTexto}
          placeholder="Otro medio de pago (opcional)"
        />
      </View>

      <Pressable style={estilos.botonGuardar} onPress={guardar} disabled={guardando}>
        <Text style={estilos.textoBotonGuardar}>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar gasto'}</Text>
      </Pressable>

      {editando && (
        <Pressable style={estilos.botonBorrar} onPress={borrar}>
          <Text style={estilos.textoBotonBorrar}>Borrar gasto</Text>
        </Pressable>
      )}
    </BottomSheet>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    inputMonto: { fontSize: 40, fontWeight: '700', color: colors.text1, textAlign: 'center', marginBottom: spacing.sm },
    opcionales: { marginTop: spacing.sm, marginBottom: spacing.lg },
    etiquetaCampo: { color: colors.text2, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
    ayudaFuente: { color: colors.text3, fontSize: 12, marginTop: -spacing.xs, marginBottom: spacing.xs },
    filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
    chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    textoChip: { color: colors.text2 },
    inputTexto: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface },
    botonGuardar: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.md, alignItems: 'center' },
    textoBotonGuardar: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
    botonBorrar: { alignItems: 'center', padding: spacing.md },
    textoBotonBorrar: { color: colors.red, fontWeight: '600' },
  });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: misma línea base de errores preexistentes de siempre, nada nuevo.

- [ ] **Step 3: Correr la suite completa**

Run: `npm test`
Expected: PASS — todos los tests, incluidos los de la Task 1.

- [ ] **Step 4: Commit**

```bash
git add app/gasto-nuevo.tsx
git commit -m "autoselecciona el sector según el historial de gastos por lugar"
```
