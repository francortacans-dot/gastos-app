import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, FlatList, StyleSheet } from 'react-native';
import { useApp } from '../../src/app-context';
import { useMesActual } from '../../src/hooks/use-mes-actual';
import { useResumenMes } from '../../src/hooks/use-resumen-mes';
import { useSectores, useGastos } from '../../src/hooks/use-datos';
import { gastadoPorSector, gastadoEnMes, mesAnterior } from '../../src/domain/budget';
import { PieChart } from '../../src/components/pie-chart';
import { BarChart, type BarraDato } from '../../src/components/bar-chart';
import { SelectorFecha } from '../../src/components/selector-fecha';
import { MoneyText } from '../../src/components/money-text';
import { IconTrash } from '../../src/components/icons';
import { formatCentavos } from '../../src/domain/money';
import { useColors } from '../../src/theme/theme-context';
import type { Colors } from '../../src/theme/palettes';
import { spacing } from '../../src/theme/spacing';

function etiquetaCortaDeMes(mesClave: string): string {
  const [anio, mesNum] = mesClave.split('-').map(Number);
  const texto = new Date(anio, mesNum - 1, 1).toLocaleDateString('es-AR', { month: 'short' });
  return texto.charAt(0).toUpperCase() + texto.slice(1).replace('.', '');
}

export default function Historial() {
  const { repos } = useApp();
  const { mes, irAMes } = useMesActual();
  const resumen = useResumenMes(mes);
  const sectores = useSectores();
  const gastos = useGastos();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

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
  const porciones = sectores
    .map((s) => ({ etiqueta: s.nombre, valor: gastoPorSector.get(s.id) ?? 0, color: s.color }))
    .filter((p) => p.valor > 0);

  const gastosDelMes = gastos
    .filter((g) => g.fecha.slice(0, 7) === mes)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const fechasConGasto = new Set(gastosDelMes.map((g) => g.fecha));
  const gastosAMostrar = diaSeleccionado ? gastosDelMes.filter((g) => g.fecha === diaSeleccionado) : gastosDelMes;

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
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

      <FlatList
        data={gastosAMostrar}
        keyExtractor={(g) => g.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={estilos.filaGasto}>
            <View style={estilos.infoGasto}>
              <Text style={estilos.descripcionGasto}>{item.descripcion ?? item.lugar ?? 'Gasto sin descripción'}</Text>
              <Text style={estilos.fechaGasto}>{item.fecha}</Text>
            </View>
            <Text style={estilos.montoGasto}>{formatCentavos(item.centavosArs)}</Text>
            <Pressable onPress={() => repos.expenses.eliminar(item.id)} hitSlop={8} style={estilos.botonBorrar}>
              <IconTrash color={colors.text4} size={16} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <Text style={estilos.vacio}>{diaSeleccionado ? 'Sin gastos ese día.' : 'Sin gastos este mes.'}</Text>
        }
      />
    </ScrollView>
  );
}

function crearEstilos(colors: Colors) {
  const sombra = { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as const;

  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg },
    contenido: { padding: spacing.md },
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
    montoGasto: { color: colors.text1, fontWeight: '700' },
    botonBorrar: { padding: 4 },
    vacio: { color: colors.text3, textAlign: 'center', marginTop: spacing.md },
  });
}
