import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMesActual } from '../../src/hooks/use-mes-actual';
import { useResumenMes } from '../../src/hooks/use-resumen-mes';
import { useSectores } from '../../src/hooks/use-datos';
import { useGastos } from '../../src/hooks/use-datos';
import { useCotizacionActual } from '../../src/hooks/use-cotizacion-actual';
import { usePreferences } from '../../src/preferences/use-preferences';
import { gastadoPorSector, SIN_SECTOR } from '../../src/domain/budget';
import { PieChart } from '../../src/components/pie-chart';
import { SectorProgress } from '../../src/components/sector-progress';
import { MoneyText } from '../../src/components/money-text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function Home() {
  const router = useRouter();
  const { mes } = useMesActual();
  const resumen = useResumenMes(mes);
  const sectores = useSectores();
  const gastos = useGastos();
  const preferencias = usePreferences();
  const cotizacion = useCotizacionActual(preferencias.cotizacionPreferida);

  const gastoPorSector = gastadoPorSector(gastos, mes);
  const porciones = [
    ...sectores.map((s) => ({ etiqueta: s.nombre, valor: gastoPorSector.get(s.id) ?? 0, color: s.color })),
    { etiqueta: 'Sin sector', valor: gastoPorSector.get(SIN_SECTOR) ?? 0, color: colors.text4 },
  ].filter((p) => p.valor > 0);

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      <View style={estilos.filaMoneda}>
        <Pressable onPress={() => preferencias.setMonedaVisualizacion('ARS')}>
          <Text style={[estilos.toggle, preferencias.monedaVisualizacion === 'ARS' && estilos.toggleActivo]}>ARS</Text>
        </Pressable>
        <Pressable onPress={() => preferencias.setMonedaVisualizacion('USD')}>
          <Text style={[estilos.toggle, preferencias.monedaVisualizacion === 'USD' && estilos.toggleActivo]}>USD</Text>
        </Pressable>
      </View>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.etiqueta}>Disponible este mes</Text>
        <MoneyText
          centavos={resumen.disponible}
          moneda={preferencias.monedaVisualizacion}
          cotizacion={cotizacion?.venta}
          style={estilos.montoGrande}
        />
        <View style={estilos.filaDetalle}>
          <Text style={estilos.detalle}>
            Presupuesto: <MoneyText centavos={resumen.presupuestoDelMes} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} />
          </Text>
          <Text style={estilos.detalle}>
            Gastado: <MoneyText centavos={resumen.gastado} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} />
          </Text>
        </View>
        {resumen.acumuladoPrevio > 0 && (
          <Pressable style={estilos.chipAcumulado} onPress={() => router.push('/(tabs)/ahorro')}>
            <Text style={estilos.textoChip}>
              +<MoneyText centavos={resumen.acumuladoPrevio} moneda="ARS" style={estilos.textoChip} /> de meses anteriores
            </Text>
          </Pressable>
        )}
      </View>

      {porciones.length > 0 && (
        <View style={estilos.centrado}>
          <PieChart porciones={porciones} size={220} />
        </View>
      )}

      <View style={estilos.seccion}>
        {sectores.map((s) => (
          <SectorProgress key={s.id} nombre={s.nombre} color={s.color} gastado={gastoPorSector.get(s.id) ?? 0} limite={s.limiteMensual} />
        ))}
      </View>

      <Pressable style={estilos.botonFlotante} onPress={() => router.push('/gasto-nuevo')}>
        <Text style={estilos.textoBotonFlotante}>+</Text>
      </Pressable>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
  filaMoneda: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm },
  toggle: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, color: colors.text3, fontWeight: '600' },
  toggleActivo: { color: colors.primary, textDecorationLine: 'underline' },
  tarjetaResumen: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
  etiqueta: { color: colors.text3, marginBottom: spacing.xs },
  montoGrande: { fontSize: 32, fontWeight: '700' },
  filaDetalle: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  detalle: { color: colors.text2 },
  chipAcumulado: { marginTop: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
  textoChip: { color: colors.primaryDark, fontWeight: '600' },
  centrado: { alignItems: 'center', marginBottom: spacing.md },
  seccion: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg },
  botonFlotante: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  textoBotonFlotante: { color: colors.surface, fontSize: 28, lineHeight: 30 },
});
