# Origen de movimientos de ahorro (presupuesto vs. aporte externo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir mandar a ahorro plata que no salió del presupuesto mensual (aporte externo), sin que el tope de `acumuladoPrevio` la bloquee y sin que descuente del arrastre al mes siguiente.

**Architecture:** Se agrega un campo `origen: 'ingresos' | 'externo'` a `SavingMovement`. `ahorradoHasta` gana un parámetro opcional de filtro por origen; `calcularResumenMes` lo usa para que solo los movimientos `'ingresos'` descuenten el acumulado arrastrado. La UI de Ahorro agrega un selector de origen (chips, mismo patrón visual que el selector de moneda en `inversion-nueva.tsx`) y solo aplica el tope cuando el origen es `'ingresos'`.

**Tech Stack:** TypeScript, Expo Router, React Native, Jest.

## Global Constraints

- Los movimientos históricos sin campo `origen` guardado en Firestore se tratan como `'ingresos'` en todos lados (cálculo y UI) — no se puede asumir que el campo siempre está presente.
- No tocar `goal-repo.ts` ni `objetivo-nuevo.tsx` — los Objetivos son un sistema separado.
- `repos.savings.agregar` ya tipa su parámetro como `Omit<SavingMovement, 'id'>`, así que no requiere cambios de código: agregar `origen` a `SavingMovement` alcanza para que el repo lo acepte y persista.
- Al terminar, correr `npm test` y confirmar que pasa todo (incluye typecheck vía `ts-jest`/tsc según config del proyecto).

---

### Task 1: Agregar `origen` a `SavingMovement`

**Files:**
- Modify: `src/domain/types.ts:45-52`

**Interfaces:**
- Produces: `SavingMovement.origen: 'ingresos' | 'externo'` — consumido por Task 2 (budget.ts) y Task 3 (ahorro.tsx).

- [ ] **Step 1: Editar la interfaz**

Reemplazar el bloque actual:

```typescript
export interface SavingMovement {
  id: string;
  /** Positivo = se manda a ahorro. Negativo = se retira del ahorro. */
  centavosArs: number;
  /** Fecha ISO 'YYYY-MM-DD'. */
  fecha: string;
  nota: string | null;
}
```

por:

```typescript
export interface SavingMovement {
  id: string;
  /** Positivo = se manda a ahorro. Negativo = se retira del ahorro. */
  centavosArs: number;
  /** Fecha ISO 'YYYY-MM-DD'. */
  fecha: string;
  nota: string | null;
  /**
   * De dónde sale la plata que se manda a ahorro:
   * - 'ingresos': salió del presupuesto mensual (comportamiento histórico). Tiene tope
   *   igual al `acumuladoPrevio` y descuenta ese monto del acumulado que se arrastra
   *   al mes siguiente.
   * - 'externo': aporte que nunca pasó por el presupuesto (regalo, aguinaldo, etc.).
   *   No tiene tope y no descuenta nada del acumulado arrastrado.
   * Movimientos históricos guardados antes de este campo no lo tienen: se deben
   * tratar como 'ingresos' en todo cálculo y en la UI.
   */
  origen: 'ingresos' | 'externo';
}
```

- [ ] **Step 2: Verificar que el editor no reporte errores de sintaxis**

No hay test unitario para un archivo de tipos puro; el chequeo real llega en Task 4 vía `npm test` (typecheck). Por ahora, confirmar visualmente que el archivo quedó bien formado.

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "agrega origen a SavingMovement (ingresos vs aporte externo)"
```

---

### Task 2: Filtrar por origen en `budget.ts`

**Files:**
- Modify: `src/domain/budget.ts:38-42` (función `ahorradoHasta`) y `src/domain/budget.ts:84-90` (dentro de `calcularResumenMes`)
- Test: `src/domain/__tests__/budget.test.ts` (se actualiza en Task 4, después de que esta función exista con la nueva firma)

**Interfaces:**
- Consumes: `SavingMovement.origen` (Task 1).
- Produces: `ahorradoHasta(movimientos: SavingMovement[], mes: MonthKey, origen?: 'ingresos' | 'externo'): number` — consumido por Task 4 (tests) y ya usado internamente por `calcularResumenMes`.

- [ ] **Step 1: Reemplazar `ahorradoHasta`**

Reemplazar:

```typescript
export function ahorradoHasta(movimientos: SavingMovement[], mes: MonthKey): number {
  return movimientos
    .filter((m) => mesDeFecha(m.fecha) <= mes)
    .reduce((acc, m) => acc + m.centavosArs, 0);
}
```

por:

```typescript
/** Movimientos históricos guardados antes de existir el campo `origen` cuentan como 'ingresos'. */
function origenEfectivo(m: SavingMovement): 'ingresos' | 'externo' {
  return m.origen ?? 'ingresos';
}

export function ahorradoHasta(
  movimientos: SavingMovement[],
  mes: MonthKey,
  origen?: 'ingresos' | 'externo'
): number {
  return movimientos
    .filter((m) => mesDeFecha(m.fecha) <= mes)
    .filter((m) => origen === undefined || origenEfectivo(m) === origen)
    .reduce((acc, m) => acc + m.centavosArs, 0);
}
```

- [ ] **Step 2: Usar el filtro `'ingresos'` en `calcularResumenMes`**

Dentro de `calcularResumenMes`, reemplazar:

```typescript
    const ahorradoHastaPrevio = ahorradoHasta(ahorros, mesPrevio);
    const ahorradoHastaAntesDePrevio = ahorradoHasta(ahorros, mesAnterior(mesPrevio));
    const mandadoAAhorroEnMesPrevio = ahorradoHastaPrevio - ahorradoHastaAntesDePrevio;
```

por:

```typescript
    const ahorradoHastaPrevio = ahorradoHasta(ahorros, mesPrevio, 'ingresos');
    const ahorradoHastaAntesDePrevio = ahorradoHasta(ahorros, mesAnterior(mesPrevio), 'ingresos');
    const mandadoAAhorroEnMesPrevio = ahorradoHastaPrevio - ahorradoHastaAntesDePrevio;
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/budget.ts
git commit -m "ahorradoHasta filtra por origen; solo ingresos descuenta el acumulado arrastrado"
```

(El test real de este cambio corre en Task 4; no hay build/typecheck aislado más rápido en este proyecto que `npm test`, así que el commit de este paso puede quedar con el typecheck pendiente hasta Task 4. Si preferís validar antes, corré `npx tsc --noEmit` acá.)

---

### Task 3: UI de Ahorro — selector de origen, tope condicional, etiqueta en historial

**Files:**
- Modify: `app/(tabs)/ahorro.tsx`

**Interfaces:**
- Consumes: `SavingMovement.origen` (Task 1), `resumen.acumuladoPrevio` (ya existente en `ResumenMes`).
- Produces: nada consumido por otras tasks.

- [ ] **Step 1: Agregar estado de origen**

En `app/(tabs)/ahorro.tsx`, junto a los demás `useState` (después de la línea `const [enviando, setEnviando] = useState(false);`):

```typescript
  const [origen, setOrigen] = useState<'ingresos' | 'externo'>('ingresos');
```

- [ ] **Step 2: Aplicar el tope solo cuando el origen es 'ingresos'**

Reemplazar dentro de `mandarAAhorro`:

```typescript
    if (centavos > resumen.acumuladoPrevio) {
      setError(`No podés mandar más de ${formatCentavos(resumen.acumuladoPrevio)} (tu acumulado disponible)`);
      return;
    }
```

por:

```typescript
    if (origen === 'ingresos' && centavos > resumen.acumuladoPrevio) {
      setError(`No podés mandar más de ${formatCentavos(resumen.acumuladoPrevio)} (tu acumulado disponible)`);
      return;
    }
```

- [ ] **Step 3: Pasar `origen` al repo y resetearlo al mandar**

Reemplazar:

```typescript
    setEnviando(true);
    try {
      await repos.savings.agregar({
        centavosArs: centavos,
        fecha: new Date().toISOString().slice(0, 10),
        nota: null,
      });
      setMontoTexto('');
      setError(null);
    } finally {
      setEnviando(false);
    }
```

por:

```typescript
    setEnviando(true);
    try {
      await repos.savings.agregar({
        centavosArs: centavos,
        fecha: new Date().toISOString().slice(0, 10),
        nota: null,
        origen,
      });
      setMontoTexto('');
      setError(null);
    } finally {
      setEnviando(false);
    }
```

- [ ] **Step 4: Agregar el selector de chips antes del input de monto**

Reemplazar:

```typescript
        <Text style={estilos.tituloSeccion}>Mandar a ahorro general</Text>
        <View style={estilos.formulario}>
          <TextInput
```

por:

```typescript
        <Text style={estilos.tituloSeccion}>Mandar a ahorro general</Text>
        <View style={estilos.formulario}>
          <View style={estilos.filaChips}>
            <Pressable
              onPress={() => setOrigen('ingresos')}
              style={[estilos.chip, origen === 'ingresos' && estilos.chipActivo]}
            >
              <Text style={[estilos.textoChip, origen === 'ingresos' && estilos.textoChipActivo]}>
                De mi presupuesto
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setOrigen('externo')}
              style={[estilos.chip, origen === 'externo' && estilos.chipActivo]}
            >
              <Text style={[estilos.textoChip, origen === 'externo' && estilos.textoChipActivo]}>
                Aporte externo
              </Text>
            </Pressable>
          </View>
          <TextInput
```

- [ ] **Step 5: Mostrar la etiqueta de origen en el historial**

Reemplazar:

```typescript
        <FlatList
          data={movimientosOrdenados}
          keyExtractor={(m) => m.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={estilos.filaMovimiento}>
              <Text style={estilos.fechaMovimiento}>{item.fecha}</Text>
              <Text style={estilos.montoMovimiento}>{formatCentavos(item.centavosArs)}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={estilos.vacio}>Todavía no mandaste nada a ahorro.</Text>}
        />
```

por:

```typescript
        <FlatList
          data={movimientosOrdenados}
          keyExtractor={(m) => m.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={estilos.filaMovimiento}>
              <View>
                <Text style={estilos.fechaMovimiento}>{item.fecha}</Text>
                <Text style={estilos.etiquetaOrigen}>
                  {(item.origen ?? 'ingresos') === 'ingresos' ? 'De presupuesto' : 'Aporte externo'}
                </Text>
              </View>
              <Text style={estilos.montoMovimiento}>{formatCentavos(item.centavosArs)}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={estilos.vacio}>Todavía no mandaste nada a ahorro.</Text>}
        />
```

- [ ] **Step 6: Agregar los estilos nuevos (`filaChips`, `chip`, `chipActivo`, `textoChip`, `textoChipActivo`, `etiquetaOrigen`)**

Mismo patrón visual que `app/inversion-nueva.tsx`. En `crearEstilos`, dentro del objeto que devuelve `StyleSheet.create({...})`, agregar después de `formulario: { marginBottom: spacing.md },`:

```typescript
    filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    chipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    textoChip: { color: colors.text2 },
    textoChipActivo: { color: colors.onPrimary },
```

Y agregar después de `fechaMovimiento: { color: colors.text3 },`:

```typescript
    etiquetaOrigen: { color: colors.text3, fontSize: 11, marginTop: 2 },
```

- [ ] **Step 7: Correr los tests del proyecto para confirmar que no rompió el typecheck de este archivo**

Run: `npm test`
Expected: puede seguir fallando por Task 4 (fixtures viejos sin `origen`) hasta completarla — no hay test dedicado a este componente. Confirmar al menos que no aparecen errores de TypeScript nuevos apuntando a `ahorro.tsx`.

- [ ] **Step 8: Commit**

```bash
git add "app/(tabs)/ahorro.tsx"
git commit -m "agrega selector de origen en Ahorro y tope condicional a aportes de presupuesto"
```

---

### Task 4: Actualizar fixtures y agregar tests en `budget.test.ts`

**Files:**
- Modify: `src/domain/__tests__/budget.test.ts`

**Interfaces:**
- Consumes: `ahorradoHasta(movimientos, mes, origen?)` (Task 2), `SavingMovement.origen` (Task 1).

- [ ] **Step 1: Agregar un helper `movimiento()` para fixtures de `SavingMovement`, igual al patrón de `gasto()`**

Después de la función `gasto()` (línea 25), agregar:

```typescript
function movimiento(parcial: Partial<SavingMovement>): SavingMovement {
  return {
    id: 'm1',
    centavosArs: 0,
    fecha: '2026-06-01',
    nota: null,
    origen: 'ingresos',
    ...parcial,
  };
}
```

- [ ] **Step 2: Actualizar los fixtures existentes de `SavingMovement` en `describe('ahorradoHasta', ...)`**

Reemplazar el bloque completo:

```typescript
describe('ahorradoHasta', () => {
  it('suma los movimientos de ahorro hasta el mes inclusive', () => {
    const movimientos: SavingMovement[] = [
      { id: 'm1', centavosArs: 5000, fecha: '2026-04-15', nota: null },
      { id: 'm2', centavosArs: 3000, fecha: '2026-06-01', nota: null },
      { id: 'm3', centavosArs: 1000, fecha: '2026-07-01', nota: null },
    ];
    expect(ahorradoHasta(movimientos, '2026-06')).toBe(8000);
  });

  it('resta los retiros de ahorro (montos negativos)', () => {
    const movimientos: SavingMovement[] = [
      { id: 'm1', centavosArs: 5000, fecha: '2026-04-15', nota: null },
      { id: 'm2', centavosArs: -2000, fecha: '2026-05-01', nota: null },
    ];
    expect(ahorradoHasta(movimientos, '2026-06')).toBe(3000);
  });
});
```

por:

```typescript
describe('ahorradoHasta', () => {
  it('suma los movimientos de ahorro hasta el mes inclusive', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-04-15' }),
      movimiento({ id: 'm2', centavosArs: 3000, fecha: '2026-06-01' }),
      movimiento({ id: 'm3', centavosArs: 1000, fecha: '2026-07-01' }),
    ];
    expect(ahorradoHasta(movimientos, '2026-06')).toBe(8000);
  });

  it('resta los retiros de ahorro (montos negativos)', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-04-15' }),
      movimiento({ id: 'm2', centavosArs: -2000, fecha: '2026-05-01' }),
    ];
    expect(ahorradoHasta(movimientos, '2026-06')).toBe(3000);
  });
});

describe('ahorradoHasta con filtro de origen', () => {
  it('filtra solo los movimientos "ingresos" cuando se pide ese origen', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-06-01', origen: 'ingresos' }),
      movimiento({ id: 'm2', centavosArs: 2000, fecha: '2026-06-02', origen: 'externo' }),
    ];
    expect(ahorradoHasta(movimientos, '2026-06', 'ingresos')).toBe(5000);
  });

  it('filtra solo los movimientos "externo" cuando se pide ese origen', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-06-01', origen: 'ingresos' }),
      movimiento({ id: 'm2', centavosArs: 2000, fecha: '2026-06-02', origen: 'externo' }),
    ];
    expect(ahorradoHasta(movimientos, '2026-06', 'externo')).toBe(2000);
  });

  it('sin filtro de origen, suma todos los movimientos sin importar el origen', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-06-01', origen: 'ingresos' }),
      movimiento({ id: 'm2', centavosArs: 2000, fecha: '2026-06-02', origen: 'externo' }),
    ];
    expect(ahorradoHasta(movimientos, '2026-06')).toBe(7000);
  });

  it('trata los movimientos históricos sin campo origen guardado como "ingresos"', () => {
    // simula un doc viejo de Firestore, guardado antes de que existiera el campo `origen`
    const movimientos = [
      { id: 'm1', centavosArs: 4000, fecha: '2026-06-01', nota: null },
    ] as SavingMovement[];
    expect(ahorradoHasta(movimientos, '2026-06', 'ingresos')).toBe(4000);
    expect(ahorradoHasta(movimientos, '2026-06', 'externo')).toBe(0);
  });
});
```

- [ ] **Step 3: Actualizar el fixture de `SavingMovement` en el test `'no arrastra lo que ya se mandó a ahorro'`**

Reemplazar:

```typescript
    const ahorros: SavingMovement[] = [{ id: 's1', centavosArs: 30000, fecha: '2026-05-28', nota: null }];
```

por:

```typescript
    const ahorros: SavingMovement[] = [movimiento({ id: 's1', centavosArs: 30000, fecha: '2026-05-28', origen: 'ingresos' })];
```

- [ ] **Step 4: Agregar el test de aporte externo que no descuenta el arrastre**

Dentro de `describe('calcularResumenMes', ...)`, después del test `'no arrastra lo que ya se mandó a ahorro'` (justo antes de `it('un mes sin presupuesto definido cuenta como presupuesto 0', ...)`), agregar:

```typescript
  it('un aporte externo mandado a ahorro no reduce el acumuladoPrevio del mes siguiente', () => {
    const presupuestos: Budget[] = [
      { mes: '2026-05', totalCentavos: 50000 },
      { mes: '2026-06', totalCentavos: 100000 },
    ];
    // en mayo se gastaron 20000 de 50000: sobran 30000 que deberían arrastrar a junio
    const gastos: Expense[] = [gasto({ id: 'may', centavosArs: 20000, fecha: '2026-05-10' })];
    // aporte externo (ej. regalo) mandado en mayo: nunca salió del presupuesto, no debe descontar el arrastre
    const ahorros: SavingMovement[] = [
      movimiento({ id: 's1', centavosArs: 15000, fecha: '2026-05-28', origen: 'externo' }),
    ];

    const resumen = calcularResumenMes({
      mes: '2026-06',
      presupuestos,
      gastos,
      ahorros,
    });

    expect(resumen.acumuladoPrevio).toBe(30000);
    expect(resumen.disponible).toBe(100000 + 30000);
  });
```

- [ ] **Step 5: Correr la suite completa**

Run: `npm test`
Expected: todos los tests pasan, incluidos los nuevos de `ahorradoHasta con filtro de origen` y el de aporte externo en `calcularResumenMes`.

- [ ] **Step 6: Commit**

```bash
git add src/domain/__tests__/budget.test.ts
git commit -m "actualiza fixtures y agrega tests de origen en movimientos de ahorro"
```

---

## Verificación final

- [ ] **Correr toda la suite una vez más desde la raíz del repo**

Run: `npm test`
Expected: 0 failing, incluye typecheck (el proyecto usa `ts-jest`, que falla si hay errores de tipos en los archivos tocados).
