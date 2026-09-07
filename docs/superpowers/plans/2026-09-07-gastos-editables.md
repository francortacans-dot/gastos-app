# Gastos editables + feed unificado — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar un gasto ya cargado (no solo borrarlo), manteniendo consistente el movimiento de ahorro vinculado cuando la fuente es `'ahorro'`, y reemplazar la sección "Últimos gastos" de Inicio por un feed que mezcla gastos, movimientos de ahorro e inversiones.

**Architecture:** Sigue exactamente los patrones ya establecidos en el repo: repos local-first con upsert por `guardar()` (mismo patrón que `SectorRepo`/`InvestmentRepo`), una función de orquestación pura estilo `pagarGasto`/`eliminarGasto` para la lógica de edición+ahorro, y una función de dominio pura y testeada para combinar las 4 fuentes de datos del feed.

**Tech Stack:** TypeScript, Expo Router, Firebase, Jest (mismo stack que el resto del proyecto — sin dependencias nuevas).

## Global Constraints

- **Moneda canónica: ARS en centavos enteros.** Todo monto se guarda y calcula como `number` entero de centavos de ARS.
- **Comentarios en español.** camelCase para variables/funciones, kebab-case para archivos, PascalCase para componentes.
- **TDD**: lógica no visual (dominio, repos, orquestadores) se escribe con test que falla primero. Las pantallas (`app/**/*.tsx`) no tienen tests automáticos en este repo — se verifican con `npx tsc --noEmit` y lectura manual, no exigir Jest ahí.
- **Los repos nuevos/editados nunca deben depender de releer el snapshot local para la corrección de la escritura a Firestore** — el mismo bug que rompió el flujo de venta de Inversiones en web (el `LocalStore` es un no-op ahí). `ExpenseRepo.guardar()` debe seguir el patrón upsert de `InvestmentRepo.guardar()`: usa el snapshot local solo para el caché de exhibición, nunca como condición para que la escritura a Firestore sea correcta.
- **No se modifica `src/domain/budget.ts`** — esta pieza reutiliza `totalAhorrado()` (ya existe) sin tocar su implementación.
- **Colores**: usar exclusivamente los tokens de `useColors()` (`src/theme/theme-context.tsx` + `src/theme/palettes.ts`), nunca colores sueltos.
- **Commits en español, descriptivos, en imperativo.**

---

## Estructura de archivos

```
src/
├── repos/
│   ├── expense-repo.ts        # MODIFICAR: agrega guardar()
│   ├── editar-gasto.ts        # NUEVO: orquestación de edición + ahorro vinculado
│   └── __tests__/
│       ├── expense-repo.test.ts   # MODIFICAR: agrega tests de guardar()
│       └── editar-gasto.test.ts   # NUEVO
├── domain/
│   ├── feed-movimientos.ts        # NUEVO: combina gastos+ahorro+inversiones en un feed
│   └── __tests__/
│       └── feed-movimientos.test.ts  # NUEVO
app/
├── gasto-nuevo.tsx             # MODIFICAR: modo edición + borrar
└── (tabs)/
    ├── historial.tsx           # MODIFICAR: tap-to-edit en cada fila
    └── index.tsx                # MODIFICAR: reemplaza "Últimos gastos" por el feed unificado
```

---

## Task 1: `ExpenseRepo.guardar()`

**Files:**
- Modify: `src/repos/expense-repo.ts`
- Modify: `src/repos/__tests__/expense-repo.test.ts`

**Interfaces:**
- Consumes: `Expense` de `src/domain/types.ts` (ya existe, sin cambios)
- Produces: `ExpenseRepo.guardar(gasto: Expense): Promise<Expense>` — nuevo método, se suma a `listar`/`agregar`/`eliminar`/`suscribir` ya existentes (sin cambios en esos).

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/repos/__tests__/expense-repo.test.ts` (antes del cierre del `describe('crearExpenseRepo sin conexión', ...)`, como dos `it` nuevos):

```typescript
  it('guardar() reemplaza un gasto existente y listar() lo refleja', async () => {
    const store = crearStoreFake();
    const repo = crearExpenseRepo({
      db: null as any,
      uid: 'u1',
      localStore: store,
      estaOnline: () => false,
    });

    const gasto = await repo.agregar(gastoParcial());
    const actualizado = await repo.guardar({ ...gasto, centavosArs: 9000, descripcion: 'Actualizado' });

    expect(actualizado.centavosArs).toBe(9000);
    const lista = await repo.listar();
    expect(lista).toHaveLength(1);
    expect(lista[0].descripcion).toBe('Actualizado');
  });

  it('guardar() con un id que no está en el store local igual lo agrega (no depende de leer el estado previo)', async () => {
    const store = crearStoreFake();
    const repo = crearExpenseRepo({
      db: null as any,
      uid: 'u1',
      localStore: store,
      estaOnline: () => false,
    });

    const gasto: Expense = { ...gastoParcial(), id: 'externo-1' };
    const guardado = await repo.guardar(gasto);

    expect(guardado.id).toBe('externo-1');
    const lista = await repo.listar();
    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe('externo-1');
  });
```

(El archivo ya importa `Expense` desde `'../../domain/types'` y define `gastoParcial()`/`crearStoreFake()` — no hace falta agregar nada más arriba del archivo.)

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx jest expense-repo`
Expected: FAIL — `repo.guardar is not a function`.

- [ ] **Step 3: Implementar `guardar()` en `src/repos/expense-repo.ts`**

Cambiar la interfaz `ExpenseRepo` de:

```typescript
export interface ExpenseRepo {
  listar(): Promise<Expense[]>;
  agregar(gasto: Omit<Expense, 'id'>): Promise<Expense>;
  eliminar(id: string): Promise<void>;
  /** Se suscribe a cambios en tiempo real (solo tiene efecto real si hay red). Devuelve función para desuscribirse. */
  suscribir(cb: (gastos: Expense[]) => void): () => void;
}
```

a:

```typescript
export interface ExpenseRepo {
  listar(): Promise<Expense[]>;
  agregar(gasto: Omit<Expense, 'id'>): Promise<Expense>;
  guardar(gasto: Expense): Promise<Expense>;
  eliminar(id: string): Promise<void>;
  /** Se suscribe a cambios en tiempo real (solo tiene efecto real si hay red). Devuelve función para desuscribirse. */
  suscribir(cb: (gastos: Expense[]) => void): () => void;
}
```

Agregar el método al objeto devuelto por `crearExpenseRepo`, entre `agregar` y `eliminar`:

```typescript
    async guardar(gasto: Expense): Promise<Expense> {
      const actuales = await leerLocal();
      const yaExiste = actuales.some((g) => g.id === gasto.id);
      await escribirLocal(yaExiste ? actuales.map((g) => (g.id === gasto.id ? gasto : g)) : [...actuales, gasto]);

      await localStore.guardarPendiente({
        id: gasto.id,
        coleccion: COLECCION,
        operacion: 'set',
        datos: gasto as unknown as Record<string, unknown>,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await setDoc(doc(db, 'users', uid, COLECCION, gasto.id), gasto).catch(() => {});
      }

      return gasto;
    },
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx jest expense-repo`
Expected: PASS — todos los tests de expense-repo pasan (los 3 existentes + los 2 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/repos/expense-repo.ts src/repos/__tests__/expense-repo.test.ts
git commit -m "agrega guardar() a ExpenseRepo para poder editar gastos"
```

---

## Task 2: Orquestación de edición (`editarGasto`)

**Files:**
- Create: `src/repos/editar-gasto.ts`
- Create: `src/repos/__tests__/editar-gasto.test.ts`

**Interfaces:**
- Consumes: `ExpenseRepo.guardar(gasto: Expense)` (Task 1), `totalAhorrado(movimientos: SavingMovement[]): number` de `src/domain/budget.ts` (ya existe), `formatCentavos` de `src/domain/money.ts` (ya existe), `ResultadoPagoGasto` de `src/repos/pagar-gasto.ts` (ya existe: `{ gasto: Expense; movimiento: SavingMovement | null }`)
- Produces: `function editarGasto(repos: Repos, gastoActualizado: Expense, movimientosActuales: SavingMovement[]): Promise<ResultadoPagoGasto>` — usado por Task 3.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/repos/__tests__/editar-gasto.test.ts`:

```typescript
import { editarGasto } from '../editar-gasto';
import type { Repos } from '../create-repo';
import type { Expense, SavingMovement } from '../../domain/types';

function crearGasto(parcial: Partial<Expense> = {}): Expense {
  return {
    id: 'g1',
    centavosArs: 5000,
    montoOriginal: 50,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    fecha: '2026-06-01',
    sectorId: null,
    lugar: null,
    descripcion: 'Uber',
    metodoPago: null,
    fuente: 'disponible',
    ...parcial,
  };
}

function crearMovimiento(parcial: Partial<SavingMovement> = {}): SavingMovement {
  return {
    id: 'm1',
    centavosArs: -5000,
    fecha: '2026-06-01',
    nota: 'Gasto: Uber',
    origen: null,
    destino: 'gasto',
    gastoId: 'g1',
    ...parcial,
  };
}

function crearReposFake() {
  const gastosGuardados: Expense[] = [];
  const movimientosCreados: Omit<SavingMovement, 'id'>[] = [];
  const idsMovimientosEliminados: string[] = [];
  let contadorId = 0;

  const repos = {
    expenses: {
      guardar: jest.fn(async (gasto: Expense) => {
        gastosGuardados.push(gasto);
        return gasto;
      }),
    },
    savings: {
      agregar: jest.fn(async (movimiento: Omit<SavingMovement, 'id'>) => {
        movimientosCreados.push(movimiento);
        contadorId += 1;
        return { ...movimiento, id: `mov${contadorId}` };
      }),
      eliminar: jest.fn(async (id: string) => {
        idsMovimientosEliminados.push(id);
      }),
    },
  };

  return { repos: repos as unknown as Repos, gastosGuardados, movimientosCreados, idsMovimientosEliminados };
}

describe('editarGasto', () => {
  it('sigue en fuente disponible: guarda el gasto, no toca ahorro', async () => {
    const { repos, gastosGuardados, movimientosCreados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ fuente: 'disponible' });

    const resultado = await editarGasto(repos, gasto, []);

    expect(resultado.movimiento).toBeNull();
    expect(gastosGuardados).toEqual([gasto]);
    expect(movimientosCreados).toHaveLength(0);
    expect(idsMovimientosEliminados).toHaveLength(0);
  });

  it('sigue en fuente ahorro pero cambia el monto: borra el retiro viejo y crea uno nuevo con el monto actual', async () => {
    const { repos, movimientosCreados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', centavosArs: 3000, fuente: 'ahorro' });
    const movimientoViejo = crearMovimiento({ id: 'm1', gastoId: 'g1', centavosArs: -5000 });

    const resultado = await editarGasto(repos, gasto, [movimientoViejo]);

    expect(idsMovimientosEliminados).toEqual(['m1']);
    expect(resultado.movimiento?.centavosArs).toBe(-3000);
    expect(movimientosCreados).toHaveLength(1);
  });

  it('pasa de disponible a ahorro: valida saldo y crea el retiro', async () => {
    const { repos, movimientosCreados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', centavosArs: 4000, fuente: 'ahorro' });
    const movimientos = [crearMovimiento({ id: 'otro', gastoId: null, destino: null, origen: 'ingresos', centavosArs: 10000 })];

    const resultado = await editarGasto(repos, gasto, movimientos);

    expect(resultado.movimiento?.centavosArs).toBe(-4000);
    expect(resultado.movimiento?.destino).toBe('gasto');
    expect(resultado.movimiento?.gastoId).toBe('g1');
    expect(movimientosCreados).toHaveLength(1);
  });

  it('pasa de ahorro a disponible: borra el retiro viejo y no crea uno nuevo', async () => {
    const { repos, movimientosCreados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', fuente: 'disponible' });
    const movimientoViejo = crearMovimiento({ id: 'm1', gastoId: 'g1' });

    const resultado = await editarGasto(repos, gasto, [movimientoViejo]);

    expect(idsMovimientosEliminados).toEqual(['m1']);
    expect(resultado.movimiento).toBeNull();
    expect(movimientosCreados).toHaveLength(0);
  });

  it('el ahorro liberado al borrar el retiro viejo cuenta a favor del nuevo monto', async () => {
    // totalAhorrado([-5000, 10000]) = 5000. Al borrar el retiro viejo (-5000) se
    // liberan esos 5000: saldoBase = 5000 + 5000 = 10000, alcanza para pedir 5000.
    const { repos } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', centavosArs: 5000, fuente: 'ahorro' });
    const movimientoViejo = crearMovimiento({ id: 'm1', gastoId: 'g1', centavosArs: -5000 });
    const movimientos = [movimientoViejo, crearMovimiento({ id: 'base', gastoId: null, destino: null, origen: 'ingresos', centavosArs: 10000 })];

    const resultado = await editarGasto(repos, gasto, movimientos);

    expect(resultado.movimiento?.centavosArs).toBe(-5000);
  });

  it('rechaza si el nuevo monto con fuente ahorro supera el saldo disponible tras liberar el retiro viejo', async () => {
    // totalAhorrado([-5000, 10000]) = 5000. saldoBase = 5000 + 5000 = 10000. Pide 20000: rechaza.
    const { repos, gastosGuardados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', centavosArs: 20000, fuente: 'ahorro' });
    const movimientoViejo = crearMovimiento({ id: 'm1', gastoId: 'g1', centavosArs: -5000 });
    const movimientos = [movimientoViejo, crearMovimiento({ id: 'base', gastoId: null, destino: null, origen: 'ingresos', centavosArs: 10000 })];

    await expect(editarGasto(repos, gasto, movimientos)).rejects.toThrow();
    expect(gastosGuardados).toHaveLength(0);
  });

  it('rechaza un gasto con centavosArs <= 0, sin guardar nada', async () => {
    const { repos, gastosGuardados } = crearReposFake();
    const gasto = crearGasto({ centavosArs: 0 });

    await expect(editarGasto(repos, gasto, [])).rejects.toThrow();
    expect(gastosGuardados).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx jest editar-gasto`
Expected: FAIL — "Cannot find module '../editar-gasto'".

- [ ] **Step 3: Implementar `src/repos/editar-gasto.ts`**

```typescript
import { totalAhorrado } from '../domain/budget';
import { formatCentavos } from '../domain/money';
import type { Expense, SavingMovement } from '../domain/types';
import type { Repos } from './create-repo';
import type { ResultadoPagoGasto } from './pagar-gasto';

/**
 * Guarda la edición de un gasto ya existente y recalcula el retiro de ahorro
 * vinculado (si correspondía o pasa a corresponder). Borra el movimiento
 * viejo antes de validar/crear el nuevo, para que el ahorro liberado al
 * cambiar de fuente o de monto cuente a favor del gasto editado, no en contra.
 */
export async function editarGasto(
  repos: Repos,
  gastoActualizado: Expense,
  movimientosActuales: SavingMovement[]
): Promise<ResultadoPagoGasto> {
  if (gastoActualizado.centavosArs <= 0) {
    throw new Error('El monto del gasto debe ser mayor a 0');
  }

  const movimientoViejo = movimientosActuales.find((m) => m.gastoId === gastoActualizado.id);
  if (movimientoViejo) {
    await repos.savings.eliminar(movimientoViejo.id);
  }

  if (gastoActualizado.fuente === 'ahorro') {
    const saldoBase = totalAhorrado(movimientosActuales) + (movimientoViejo ? -movimientoViejo.centavosArs : 0);
    if (gastoActualizado.centavosArs > saldoBase) {
      throw new Error(`No podés pagar con ahorro más de ${formatCentavos(saldoBase)} (tu saldo de ahorro)`);
    }
  }

  const gastoGuardado = await repos.expenses.guardar(gastoActualizado);

  if (gastoActualizado.fuente !== 'ahorro') {
    return { gasto: gastoGuardado, movimiento: null };
  }

  const movimiento = await repos.savings.agregar({
    centavosArs: -gastoActualizado.centavosArs,
    fecha: gastoActualizado.fecha,
    nota: `Gasto: ${gastoActualizado.descripcion ?? gastoActualizado.lugar ?? 'sin descripción'}`,
    origen: null,
    destino: 'gasto',
    gastoId: gastoActualizado.id,
  });

  return { gasto: gastoGuardado, movimiento };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx jest editar-gasto`
Expected: PASS — los 7 tests de editar-gasto pasan.

- [ ] **Step 5: Commit**

```bash
git add src/repos/editar-gasto.ts src/repos/__tests__/editar-gasto.test.ts
git commit -m "agrega orquestación de edición de gastos con ahorro vinculado"
```

---

## Task 3: Modo edición en `gasto-nuevo.tsx` + acceso desde Historial

**Files:**
- Modify: `app/gasto-nuevo.tsx`
- Modify: `app/(tabs)/historial.tsx`

**Interfaces:**
- Consumes: `editarGasto` (Task 2), `eliminarGasto` (ya existe, `src/repos/eliminar-gasto.ts`), `pagarGasto` (ya existe, `src/repos/pagar-gasto.ts`), `useGastos` (ya existe en `src/hooks/use-datos.ts`)
- Produces: nada nuevo para otras tareas — pantallas terminales de este plan.

No hay tests automáticos de pantallas en este repo (ver Global Constraints) — verificación con `npx tsc --noEmit` y lectura manual.

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
        <TextInput value={lugar} onChangeText={setLugar} style={estilos.inputTexto} placeholder="Ej: Supermercado" />

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

Nota de diseño: la fecha del gasto no es editable en este formulario (nunca lo fue — no hay selector de fecha acá) — al editar se conserva `gastoExistente.fecha` tal cual.

- [ ] **Step 2: Habilitar tap-to-edit en `app/(tabs)/historial.tsx`**

Agregar el import de `useRouter` (junto al resto de imports de `expo-router` — hoy el archivo no importa nada de `expo-router`):

```typescript
import { useRouter } from 'expo-router';
```

Dentro del componente `Historial`, agregar la línea `const router = useRouter();` junto a las otras variables derivadas de hooks (después de `const { repos } = useApp();`).

Cambiar el `renderItem` del `FlatList` de gastos de:

```tsx
        renderItem={({ item }) => (
          <View style={estilos.filaGasto}>
            <View style={estilos.infoGasto}>
              <Text style={estilos.descripcionGasto}>{item.descripcion ?? item.lugar ?? 'Gasto sin descripción'}</Text>
              <Text style={estilos.fechaGasto}>{item.fecha}</Text>
              {(item.fuente ?? 'disponible') === 'ahorro' && (
                <Text style={estilos.etiquetaAhorro}>Pagado con ahorro</Text>
              )}
            </View>
            <Text style={estilos.montoGasto}>{formatCentavos(item.centavosArs)}</Text>
            <Pressable onPress={() => borrarGasto(item)} hitSlop={8} style={estilos.botonBorrar}>
              <IconTrash color={colors.text4} size={16} />
            </Pressable>
          </View>
        )}
```

a:

```tsx
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
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: la misma línea base de errores preexistentes (`src/firebase/app.ts` `getReactNativePersistence` + 10× `Cannot find name 'global'` en `src/rates/__tests__/dolar.test.ts`), nada nuevo.

- [ ] **Step 4: Correr la suite completa (por las dudas de regresión en tests existentes)**

Run: `npm test`
Expected: PASS, mismo número de tests que antes de este task más los de las Tasks 1 y 2.

- [ ] **Step 5: Commit**

```bash
git add app/gasto-nuevo.tsx "app/(tabs)/historial.tsx"
git commit -m "agrega modo edición de gastos y acceso desde Historial"
```

---

## Task 4: Función de dominio `construirFeedMovimientos`

**Files:**
- Create: `src/domain/feed-movimientos.ts`
- Create: `src/domain/__tests__/feed-movimientos.test.ts`

**Interfaces:**
- Consumes: `Expense`, `SavingMovement`, `Investment`, `InvestmentSale` de `src/domain/types.ts` (ya existen, sin cambios)
- Produces:
  - `type MovimientoFeed = { tipo: 'gasto'; fecha: string; id: string; datos: Expense } | { tipo: 'ahorro'; fecha: string; id: string; datos: SavingMovement } | { tipo: 'inversion-alta'; fecha: string; id: string; datos: Investment } | { tipo: 'inversion-venta'; fecha: string; id: string; datos: InvestmentSale }`
  - `function construirFeedMovimientos(gastos: Expense[], ahorros: SavingMovement[], inversiones: Investment[], ventas: InvestmentSale[], limite?: number): MovimientoFeed[]` — usado por Task 5.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/domain/__tests__/feed-movimientos.test.ts`:

```typescript
import { construirFeedMovimientos } from '../feed-movimientos';
import type { Expense, SavingMovement, Investment, InvestmentSale } from '../types';

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

function movimiento(parcial: Partial<SavingMovement> = {}): SavingMovement {
  return {
    id: 'm1',
    centavosArs: 5000,
    fecha: '2026-06-01',
    nota: null,
    origen: 'ingresos',
    destino: null,
    gastoId: null,
    ...parcial,
  };
}

function inversion(parcial: Partial<Investment> = {}): Investment {
  return {
    id: 'i1',
    ticker: 'GOOGL',
    nominales: 1,
    ppc: 100,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    costoCentavosArsUnitario: 10000,
    rubro: null,
    fecha: '2026-06-01',
    status: 'OPEN',
    ...parcial,
  };
}

function venta(parcial: Partial<InvestmentSale> = {}): InvestmentSale {
  return {
    id: 'v1',
    investmentId: 'i1',
    nominalesVendidos: 1,
    precioVenta: 120,
    cotizacionUsada: null,
    ingresoCentavosArs: 12000,
    gananciaCentavosArs: 2000,
    fecha: '2026-06-01',
    ...parcial,
  };
}

describe('construirFeedMovimientos', () => {
  it('mezcla los 4 tipos y ordena por fecha descendente', () => {
    const feed = construirFeedMovimientos(
      [gasto({ id: 'g1', fecha: '2026-06-01' })],
      [movimiento({ id: 'm1', fecha: '2026-06-03' })],
      [inversion({ id: 'i1', fecha: '2026-06-02' })],
      [venta({ id: 'v1', fecha: '2026-06-04' })]
    );

    expect(feed.map((e) => e.id)).toEqual(['v1', 'm1', 'i1', 'g1']);
    expect(feed.map((e) => e.tipo)).toEqual(['inversion-venta', 'ahorro', 'inversion-alta', 'gasto']);
  });

  it('excluye los retiros de ahorro con destino "gasto" (ya representados por el gasto vinculado)', () => {
    const feed = construirFeedMovimientos(
      [gasto({ id: 'g1', fecha: '2026-06-01', fuente: 'ahorro' })],
      [movimiento({ id: 'm1', fecha: '2026-06-01', destino: 'gasto', gastoId: 'g1', centavosArs: -1000 })],
      [],
      []
    );

    expect(feed).toHaveLength(1);
    expect(feed[0].tipo).toBe('gasto');
  });

  it('incluye retiros con destino "inversiones" o "disponible" (no son duplicados de nada)', () => {
    const feed = construirFeedMovimientos(
      [],
      [
        movimiento({ id: 'm1', destino: 'inversiones', centavosArs: -1000 }),
        movimiento({ id: 'm2', destino: 'disponible', centavosArs: -500 }),
      ],
      [],
      []
    );

    expect(feed).toHaveLength(2);
  });

  it('recorta al límite pedido, quedándose con los más recientes', () => {
    const gastos = Array.from({ length: 10 }, (_, i) =>
      gasto({ id: `g${i}`, fecha: `2026-06-${String(i + 1).padStart(2, '0')}` })
    );

    const feed = construirFeedMovimientos(gastos, [], [], [], 3);

    expect(feed).toHaveLength(3);
    expect(feed.map((e) => e.id)).toEqual(['g9', 'g8', 'g7']);
  });

  it('el límite por defecto es 8', () => {
    const gastos = Array.from({ length: 10 }, (_, i) =>
      gasto({ id: `g${i}`, fecha: `2026-06-${String(i + 1).padStart(2, '0')}` })
    );

    const feed = construirFeedMovimientos(gastos, [], [], []);

    expect(feed).toHaveLength(8);
  });

  it('devuelve vacío si no hay nada', () => {
    expect(construirFeedMovimientos([], [], [], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx jest feed-movimientos`
Expected: FAIL — "Cannot find module '../feed-movimientos'".

- [ ] **Step 3: Implementar `src/domain/feed-movimientos.ts`**

```typescript
import type { Expense, SavingMovement, Investment, InvestmentSale } from './types';

export type MovimientoFeed =
  | { tipo: 'gasto'; fecha: string; id: string; datos: Expense }
  | { tipo: 'ahorro'; fecha: string; id: string; datos: SavingMovement }
  | { tipo: 'inversion-alta'; fecha: string; id: string; datos: Investment }
  | { tipo: 'inversion-venta'; fecha: string; id: string; datos: InvestmentSale };

/**
 * Combina gastos, movimientos de ahorro (excluyendo los retiros vinculados a
 * un gasto pagado con ahorro, que ya aparecen representados por ese gasto) y
 * altas/ventas de inversión en un solo feed, ordenado por fecha descendente
 * y recortado a los `limite` más recientes.
 */
export function construirFeedMovimientos(
  gastos: Expense[],
  ahorros: SavingMovement[],
  inversiones: Investment[],
  ventas: InvestmentSale[],
  limite = 8
): MovimientoFeed[] {
  const entradas: MovimientoFeed[] = [
    ...gastos.map((g): MovimientoFeed => ({ tipo: 'gasto', fecha: g.fecha, id: g.id, datos: g })),
    ...ahorros
      .filter((m) => m.destino !== 'gasto')
      .map((m): MovimientoFeed => ({ tipo: 'ahorro', fecha: m.fecha, id: m.id, datos: m })),
    ...inversiones.map((i): MovimientoFeed => ({ tipo: 'inversion-alta', fecha: i.fecha, id: i.id, datos: i })),
    ...ventas.map((v): MovimientoFeed => ({ tipo: 'inversion-venta', fecha: v.fecha, id: v.id, datos: v })),
  ];

  return entradas.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, limite);
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx jest feed-movimientos`
Expected: PASS — los 6 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add src/domain/feed-movimientos.ts src/domain/__tests__/feed-movimientos.test.ts
git commit -m "agrega función pura para combinar gastos, ahorro e inversiones en un feed"
```

---

## Task 5: Feed unificado de "últimos movimientos" en Inicio

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `construirFeedMovimientos`, `type MovimientoFeed` (Task 4); `useInversiones`, `useVentas` (ya existen en `src/hooks/use-datos.ts`); `IconAhorro`, `IconTrendingUp` (ya existen en `src/components/icons.tsx`)
- Produces: nada nuevo para otras tareas — última tarea del plan.

Nota importante: hoy la sección "Últimos gastos" **solo existe en la rama de escritorio** (`esEscritorio`) de este componente — la rama mobile no tiene ninguna sección equivalente. Este task agrega el feed unificado a **ambas** ramas.

- [ ] **Step 1: Agregar los imports nuevos**

Cambiar la línea:

```typescript
import { useSectores, useObjetivos, useAhorros } from '../../src/hooks/use-datos';
import { useGastos } from '../../src/hooks/use-datos';
```

a:

```typescript
import { useSectores, useObjetivos, useAhorros, useInversiones, useVentas } from '../../src/hooks/use-datos';
import { useGastos } from '../../src/hooks/use-datos';
```

Agregar el import de la función de dominio (junto a los demás imports de `src/domain`):

```typescript
import { construirFeedMovimientos, type MovimientoFeed } from '../../src/domain/feed-movimientos';
```

Cambiar la línea de íconos de:

```typescript
import { IconPlus, IconPencil, IconWallet, IconTrash } from '../../src/components/icons';
```

a:

```typescript
import { IconPlus, IconPencil, IconWallet, IconTrash, IconAhorro, IconTrendingUp } from '../../src/components/icons';
```

- [ ] **Step 2: Reemplazar `ultimosGastos` por el feed, y agregar el renderer**

Dentro del componente `Home`, agregar las dos llamadas a hooks nuevas junto a `const movimientos = useAhorros();`:

```typescript
  const inversiones = useInversiones();
  const ventas = useVentas();
```

Cambiar la línea:

```typescript
  const ultimosGastos = [...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);
```

a:

```typescript
  const feedMovimientos = useMemo(
    () => construirFeedMovimientos(gastos, movimientos, inversiones, ventas),
    [gastos, movimientos, inversiones, ventas]
  );
```

Agregar la función `renderFilaMovimiento`, justo antes del `const controles = (` (o en cualquier punto del cuerpo del componente antes de los `return`, siempre que esté después de `router`/`colors`/`estilos`, ya definidos arriba):

```typescript
  function renderFilaMovimiento(entrada: MovimientoFeed) {
    if (entrada.tipo === 'gasto') {
      const g = entrada.datos;
      return (
        <View key={entrada.id} style={estilos.filaGasto}>
          <Pressable style={estilos.infoGasto} onPress={() => router.push(`/gasto-nuevo?id=${g.id}`)}>
            <Text style={estilos.descripcionGasto}>{g.descripcion ?? g.lugar ?? 'Gasto sin descripción'}</Text>
            <Text style={estilos.fechaGasto}>{g.fecha}</Text>
            {(g.fuente ?? 'disponible') === 'ahorro' && (
              <Text style={estilos.etiquetaAhorro}>Pagado con ahorro</Text>
            )}
          </Pressable>
          <Text style={estilos.montoGastoFila}>{formatCentavos(g.centavosArs)}</Text>
          <Pressable onPress={() => borrarGasto(g)} hitSlop={8} style={estilos.botonBorrarGasto}>
            <IconTrash color={colors.text4} size={16} />
          </Pressable>
        </View>
      );
    }

    if (entrada.tipo === 'ahorro') {
      const m = entrada.datos;
      const esRetiro = m.centavosArs < 0;
      return (
        <View key={entrada.id} style={estilos.filaGasto}>
          <IconAhorro color={colors.text3} size={18} />
          <View style={estilos.infoGasto}>
            <Text style={estilos.descripcionGasto}>{esRetiro ? 'Retiraste de ahorro' : 'Mandaste a ahorro'}</Text>
            <Text style={estilos.fechaGasto}>{m.fecha}</Text>
          </View>
          <Text style={estilos.montoGastoFila}>{formatCentavos(Math.abs(m.centavosArs))}</Text>
        </View>
      );
    }

    if (entrada.tipo === 'inversion-alta') {
      const i = entrada.datos;
      return (
        <View key={entrada.id} style={estilos.filaGasto}>
          <IconTrendingUp color={colors.text3} size={18} />
          <View style={estilos.infoGasto}>
            <Text style={estilos.descripcionGasto}>
              Compraste {i.nominales} {i.ticker}
            </Text>
            <Text style={estilos.fechaGasto}>{i.fecha}</Text>
          </View>
        </View>
      );
    }

    const v = entrada.datos;
    const tickerVenta = inversiones.find((i) => i.id === v.investmentId)?.ticker ?? '—';
    return (
      <View key={entrada.id} style={estilos.filaGasto}>
        <IconTrendingUp color={colors.text3} size={18} />
        <View style={estilos.infoGasto}>
          <Text style={estilos.descripcionGasto}>
            Vendiste {v.nominalesVendidos} {tickerVenta}
          </Text>
          <Text style={estilos.fechaGasto}>{v.fecha}</Text>
        </View>
        <Text style={[estilos.montoGastoFila, { color: v.gananciaCentavosArs >= 0 ? colors.primaryDark : colors.red }]}>
          {v.gananciaCentavosArs >= 0 ? '+' : ''}
          {formatCentavos(v.gananciaCentavosArs)}
        </Text>
      </View>
    );
  }
```

- [ ] **Step 3: Reemplazar la sección "Últimos gastos" de la rama de escritorio**

Cambiar (dentro del `if (esEscritorio) { return ( ... ) }`):

```tsx
          <Text style={estilos.seccionTitulo}>Últimos gastos</Text>
          <Toast texto={errorBorrado} tipo="error" colors={colors} />
          <View style={estilos.seccion}>
            {ultimosGastos.length === 0 ? (
              <Text style={estilos.vacio}>Todavía no cargaste gastos este mes.</Text>
            ) : (
              ultimosGastos.map((g) => (
                <View key={g.id} style={estilos.filaGasto}>
                  <View style={estilos.infoGasto}>
                    <Text style={estilos.descripcionGasto}>{g.descripcion ?? g.lugar ?? 'Gasto sin descripción'}</Text>
                    <Text style={estilos.fechaGasto}>{g.fecha}</Text>
                    {(g.fuente ?? 'disponible') === 'ahorro' && (
                      <Text style={estilos.etiquetaAhorro}>Pagado con ahorro</Text>
                    )}
                  </View>
                  <Text style={estilos.montoGastoFila}>{formatCentavos(g.centavosArs)}</Text>
                  <Pressable onPress={() => borrarGasto(g)} hitSlop={8} style={estilos.botonBorrarGasto}>
                    <IconTrash color={colors.text4} size={16} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
```

a:

```tsx
          <Text style={estilos.seccionTitulo}>Últimos movimientos</Text>
          <Toast texto={errorBorrado} tipo="error" colors={colors} />
          <View style={estilos.seccion}>
            {feedMovimientos.length === 0 ? (
              <Text style={estilos.vacio}>Todavía no hay movimientos.</Text>
            ) : (
              feedMovimientos.map(renderFilaMovimiento)
            )}
          </View>
```

- [ ] **Step 4: Agregar la misma sección a la rama mobile**

En el `return` de la rama mobile (después del bloque `<View style={estilos.seccion}>...</View>` de Sectores, antes de `{botonFlotante}`), agregar:

```tsx
      <Text style={estilos.seccionTitulo}>Últimos movimientos</Text>
      <Toast texto={errorBorrado} tipo="error" colors={colors} />
      <View style={estilos.seccion}>
        {feedMovimientos.length === 0 ? (
          <Text style={estilos.vacio}>Todavía no hay movimientos.</Text>
        ) : (
          feedMovimientos.map(renderFilaMovimiento)
        )}
      </View>

      {botonFlotante}
```

(reemplazando la línea `{botonFlotante}` que hoy está sola al final de esa rama).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: misma línea base de errores preexistentes (11 errores: `getReactNativePersistence` + 10× `global` en `dolar.test.ts`), nada nuevo.

- [ ] **Step 6: Correr la suite completa**

Run: `npm test`
Expected: PASS — todos los tests del proyecto, incluidos los de las Tasks 1, 2 y 4 de este plan.

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "reemplaza Últimos gastos por un feed unificado de movimientos en Inicio"
```
