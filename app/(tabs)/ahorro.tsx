import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useApp } from '../../src/app-context';
import { useAhorros } from '../../src/hooks/use-datos';
import { useMesActual } from '../../src/hooks/use-mes-actual';
import { useResumenMes } from '../../src/hooks/use-resumen-mes';
import { parseAmountToCentavos, formatCentavos } from '../../src/domain/money';
import { useColors } from '../../src/theme/theme-context';
import type { Colors } from '../../src/theme/palettes';
import { spacing } from '../../src/theme/spacing';

export default function Ahorro() {
  const { repos } = useApp();
  const movimientos = useAhorros();
  const { mes } = useMesActual();
  const resumen = useResumenMes(mes);
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const [montoTexto, setMontoTexto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const totalAhorrado = movimientos.reduce((acc, m) => acc + m.centavosArs, 0);
  const movimientosOrdenados = [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha));

  async function mandarAAhorro() {
    const centavos = parseAmountToCentavos(montoTexto);
    if (centavos === null || centavos <= 0) {
      setError('Ingresá un monto válido');
      return;
    }
    if (centavos > resumen.acumuladoPrevio) {
      setError(`No podés mandar más de ${formatCentavos(resumen.acumuladoPrevio)} (tu acumulado disponible)`);
      return;
    }
    await repos.savings.agregar({
      centavosArs: centavos,
      fecha: new Date().toISOString().slice(0, 10),
      nota: null,
    });
    setMontoTexto('');
    setError(null);
  }

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.tarjetaTotal}>
        <Text style={estilos.etiqueta}>Total ahorrado</Text>
        <Text style={estilos.montoGrande}>{formatCentavos(totalAhorrado)}</Text>
        <Text style={estilos.etiqueta}>Disponible para mandar a ahorro: {formatCentavos(resumen.acumuladoPrevio)}</Text>
      </View>

      <View style={estilos.formulario}>
        <TextInput
          value={montoTexto}
          onChangeText={(t) => {
            setMontoTexto(t);
            setError(null);
          }}
          placeholder="Monto a ahorrar"
          keyboardType="decimal-pad"
          style={estilos.input}
        />
        {error && <Text style={estilos.error}>{error}</Text>}
        <Pressable style={estilos.boton} onPress={mandarAAhorro}>
          <Text style={estilos.textoBoton}>Mandar a ahorro</Text>
        </Pressable>
      </View>

      <FlatList
        data={movimientosOrdenados}
        keyExtractor={(m) => m.id}
        contentContainerStyle={estilos.lista}
        renderItem={({ item }) => (
          <View style={estilos.filaMovimiento}>
            <Text style={estilos.fechaMovimiento}>{item.fecha}</Text>
            <Text style={estilos.montoMovimiento}>{formatCentavos(item.centavosArs)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={estilos.vacio}>Todavía no mandaste nada a ahorro.</Text>}
      />
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg },
    tarjetaTotal: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, margin: spacing.md },
    etiqueta: { color: colors.text3, marginTop: spacing.xs },
    montoGrande: { fontSize: 28, fontWeight: '700', color: colors.text1 },
    formulario: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm, backgroundColor: colors.surface },
    error: { color: colors.red, marginBottom: spacing.sm },
    boton: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
    textoBoton: { color: colors.surface, fontWeight: '700' },
    lista: { paddingHorizontal: spacing.md },
    filaMovimiento: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.xs },
    fechaMovimiento: { color: colors.text3 },
    montoMovimiento: { color: colors.primaryDark, fontWeight: '700' },
    vacio: { color: colors.text3, textAlign: 'center', marginTop: spacing.md },
  });
}
