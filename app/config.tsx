import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useApp } from '../src/app-context';
import { usePreferences } from '../src/preferences/use-preferences';
import { useMesActual } from '../src/hooks/use-mes-actual';
import { usePresupuestos } from '../src/hooks/use-datos';
import { parseAmountToCentavos, formatCentavos } from '../src/domain/money';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import type { RateKind } from '../src/domain/types';

export default function Configuracion() {
  const { repos } = useApp();
  const preferencias = usePreferences();
  const { mes } = useMesActual();
  const presupuestos = usePresupuestos();

  const presupuestoActual = presupuestos.find((p) => p.mes === mes)?.totalCentavos ?? 0;
  const [presupuestoTexto, setPresupuestoTexto] = useState(
    presupuestoActual > 0 ? String(presupuestoActual / 100).replace('.', ',') : ''
  );
  const [error, setError] = useState<string | null>(null);

  async function guardarPresupuesto() {
    const centavos = parseAmountToCentavos(presupuestoTexto);
    if (centavos === null) {
      setError('Ingresá un monto válido');
      return;
    }
    await repos.budgets.guardar({ mes, totalCentavos: centavos });
    setError(null);
  }

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.seccionTitulo}>Presupuesto del mes actual</Text>
      <TextInput
        value={presupuestoTexto}
        onChangeText={(t) => {
          setPresupuestoTexto(t);
          setError(null);
        }}
        keyboardType="decimal-pad"
        style={estilos.input}
        placeholder="Ej: 150000"
      />
      {error && <Text style={estilos.error}>{error}</Text>}
      <Pressable style={estilos.boton} onPress={guardarPresupuesto}>
        <Text style={estilos.textoBoton}>Guardar presupuesto</Text>
      </Pressable>
      {presupuestoActual > 0 && (
        <Text style={estilos.actual}>Actual: {formatCentavos(presupuestoActual)}</Text>
      )}

      <Text style={estilos.seccionTitulo}>Cotización preferida</Text>
      <View style={estilos.filaOpciones}>
        {(['oficial', 'blue'] as RateKind[]).map((c) => (
          <Pressable
            key={c}
            onPress={() => preferencias.setCotizacionPreferida(c)}
            style={[estilos.opcion, preferencias.cotizacionPreferida === c && estilos.opcionActiva]}
          >
            <Text style={[estilos.textoOpcion, preferencias.cotizacionPreferida === c && estilos.textoOpcionActiva]}>
              {c === 'oficial' ? 'Oficial' : 'Blue'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={estilos.seccionTitulo}>Moneda de visualización por defecto</Text>
      <View style={estilos.filaOpciones}>
        {(['ARS', 'USD'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => preferencias.setMonedaVisualizacion(m)}
            style={[estilos.opcion, preferencias.monedaVisualizacion === m && estilos.opcionActiva]}
          >
            <Text style={[estilos.textoOpcion, preferencias.monedaVisualizacion === m && estilos.textoOpcionActiva]}>{m}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  seccionTitulo: { color: colors.text2, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface, marginBottom: spacing.sm },
  error: { color: colors.red, marginBottom: spacing.sm },
  boton: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
  textoBoton: { color: colors.surface, fontWeight: '700' },
  actual: { color: colors.text3, marginTop: spacing.xs },
  filaOpciones: { flexDirection: 'row', gap: spacing.sm },
  opcion: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  opcionActiva: { backgroundColor: colors.primary, borderColor: colors.primary },
  textoOpcion: { color: colors.text2, fontWeight: '600' },
  textoOpcionActiva: { color: colors.surface },
});
