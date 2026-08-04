import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMesActual } from '../../src/hooks/use-mes-actual';
import { useResumenMes } from '../../src/hooks/use-resumen-mes';
import { useSectores } from '../../src/hooks/use-datos';
import { useGastos } from '../../src/hooks/use-datos';
import { useCotizacionActual } from '../../src/hooks/use-cotizacion-actual';
import { usePreferences } from '../../src/preferences/use-preferences';
import { gastadoPorSector, SIN_SECTOR } from '../../src/domain/budget';
import { formatCentavos } from '../../src/domain/money';
import { PieChart } from '../../src/components/pie-chart';
import { SectorProgress } from '../../src/components/sector-progress';
import { MoneyText } from '../../src/components/money-text';
import { useColors } from '../../src/theme/theme-context';
import type { Colors } from '../../src/theme/palettes';
import { spacing } from '../../src/theme/spacing';
import { useEsEscritorio } from '../../src/hooks/use-es-escritorio';

export default function Home() {
  const router = useRouter();
  const { mes } = useMesActual();
  const resumen = useResumenMes(mes);
  const sectores = useSectores();
  const gastos = useGastos();
  const preferencias = usePreferences();
  const cotizacion = useCotizacionActual(preferencias.cotizacionPreferida);
  const esEscritorio = useEsEscritorio();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const gastoPorSector = gastadoPorSector(gastos, mes);
  const porciones = [
    ...sectores.map((s) => ({ etiqueta: s.nombre, valor: gastoPorSector.get(s.id) ?? 0, color: s.color })),
    { etiqueta: 'Sin sector', valor: gastoPorSector.get(SIN_SECTOR) ?? 0, color: colors.text4 },
  ].filter((p) => p.valor > 0);

  const ultimosGastos = [...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);

  if (esEscritorio) {
    return (
      <View style={estilos.contenedorEscritorio}>
        <ScrollView style={estilos.columnaIzquierda} contentContainerStyle={estilos.contenido}>
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
            <MoneyText centavos={resumen.disponible} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} style={estilos.montoGrande} />
            <View style={estilos.filaDetalle}>
              <Text style={estilos.detalle}>
                Presupuesto: <MoneyText centavos={resumen.presupuestoDelMes} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} />
              </Text>
              <Text style={estilos.detalle}>
                Gastado: <MoneyText centavos={resumen.gastado} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} />
              </Text>
            </View>
          </View>
          {porciones.length > 0 && (
            <View style={estilos.centrado}>
              <PieChart porciones={porciones} size={260} />
            </View>
          )}
        </ScrollView>
        <ScrollView style={estilos.columnaDerecha} contentContainerStyle={estilos.contenido}>
          <Text style={estilos.seccionTitulo}>Sectores</Text>
          <View style={estilos.seccion}>
            {sectores.length === 0 ? (
              <Pressable onPress={() => router.push('/(tabs)/sectores')}>
                <Text style={estilos.vacio}>Todavía no tenés sectores. Tocá acá para crear el primero.</Text>
              </Pressable>
            ) : (
              sectores.map((s) => (
                <SectorProgress key={s.id} nombre={s.nombre} color={s.color} gastado={gastoPorSector.get(s.id) ?? 0} limite={s.limiteMensual} />
              ))
            )}
          </View>

          <Text style={estilos.seccionTitulo}>Últimos gastos</Text>
          <View style={estilos.seccion}>
            {ultimosGastos.length === 0 ? (
              <Text style={estilos.vacio}>Todavía no cargaste gastos este mes.</Text>
            ) : (
              ultimosGastos.map((g) => (
                <View key={g.id} style={estilos.filaGasto}>
                  <View style={estilos.infoGasto}>
                    <Text style={estilos.descripcionGasto}>{g.descripcion ?? g.lugar ?? 'Gasto sin descripción'}</Text>
                    <Text style={estilos.fechaGasto}>{g.fecha}</Text>
                  </View>
                  <Text style={estilos.montoGastoFila}>{formatCentavos(g.centavosArs)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
        <Pressable style={estilos.botonFlotante} onPress={() => router.push('/gasto-nuevo')}>
          <Text style={estilos.textoBotonFlotante}>+</Text>
        </Pressable>
      </View>
    );
  }

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
        {sectores.length === 0 ? (
          <Pressable onPress={() => router.push('/(tabs)/sectores')}>
            <Text style={estilos.vacio}>Todavía no tenés sectores. Tocá acá para crear el primero.</Text>
          </Pressable>
        ) : (
          sectores.map((s) => (
            <SectorProgress key={s.id} nombre={s.nombre} color={s.color} gastado={gastoPorSector.get(s.id) ?? 0} limite={s.limiteMensual} />
          ))
        )}
      </View>

      <Pressable style={estilos.botonFlotante} onPress={() => router.push('/gasto-nuevo')}>
        <Text style={estilos.textoBotonFlotante}>+</Text>
      </Pressable>
    </ScrollView>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg },
    contenido: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
    filaMoneda: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm },
    toggle: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, color: colors.text3, fontWeight: '600' },
    toggleActivo: { color: colors.primary, textDecorationLine: 'underline' },
    tarjetaResumen: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
    etiqueta: { color: colors.text3, marginBottom: spacing.xs },
    montoGrande: { fontSize: 32, fontWeight: '700', color: colors.text1 },
    filaDetalle: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
    detalle: { color: colors.text2 },
    chipAcumulado: { marginTop: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
    textoChip: { color: colors.primaryDark, fontWeight: '600' },
    centrado: { alignItems: 'center', marginBottom: spacing.md },
    seccion: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
    vacio: { color: colors.text3 },
    filaGasto: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
    infoGasto: { flex: 1 },
    descripcionGasto: { color: colors.text1, fontWeight: '600' },
    fechaGasto: { color: colors.text3, fontSize: 12 },
    montoGastoFila: { color: colors.text1, fontWeight: '700' },
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
    contenedorEscritorio: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
    columnaIzquierda: { flex: 1, borderRightWidth: 1, borderRightColor: colors.border },
    columnaDerecha: { flex: 1 },
    seccionTitulo: { color: colors.text2, fontWeight: '700', marginBottom: spacing.sm, fontSize: 16 },
  });
}
