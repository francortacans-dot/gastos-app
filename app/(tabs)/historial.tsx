import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, FlatList, StyleSheet } from 'react-native';
import { useMesActual } from '../../src/hooks/use-mes-actual';
import { useResumenMes } from '../../src/hooks/use-resumen-mes';
import { useSectores, useGastos } from '../../src/hooks/use-datos';
import { gastadoPorSector } from '../../src/domain/budget';
import { PieChart } from '../../src/components/pie-chart';
import { CalendarMes } from '../../src/components/calendar-mes';
import { MoneyText } from '../../src/components/money-text';
import { formatCentavos } from '../../src/domain/money';
import { useColors } from '../../src/theme/theme-context';
import type { Colors } from '../../src/theme/palettes';
import { spacing } from '../../src/theme/spacing';

function nombreDeMes(mesClave: string): string {
  const [anio, mesNum] = mesClave.split('-').map(Number);
  const fecha = new Date(anio, mesNum - 1, 1);
  const texto = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function nombreDeDia(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  const texto = fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function Historial() {
  const { mes, irAMesAnterior, irAMesSiguiente } = useMesActual();
  const resumen = useResumenMes(mes);
  const sectores = useSectores();
  const gastos = useGastos();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

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
      <View style={estilos.selectorMes}>
        <Pressable
          onPress={() => {
            irAMesAnterior();
            setDiaSeleccionado(null);
          }}
        >
          <Text style={estilos.flecha}>{'‹'}</Text>
        </Pressable>
        <Text style={estilos.tituloMes}>{nombreDeMes(mes)}</Text>
        <Pressable
          onPress={() => {
            irAMesSiguiente();
            setDiaSeleccionado(null);
          }}
        >
          <Text style={estilos.flecha}>{'›'}</Text>
        </Pressable>
      </View>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.etiqueta}>Presupuesto</Text>
        <MoneyText centavos={resumen.presupuestoDelMes} moneda="ARS" style={estilos.monto} />
        <Text style={estilos.etiqueta}>Gastado</Text>
        <MoneyText centavos={resumen.gastado} moneda="ARS" style={estilos.monto} />
      </View>

      <CalendarMes
        mes={mes}
        fechasConGasto={fechasConGasto}
        diaSeleccionado={diaSeleccionado}
        onSeleccionarDia={setDiaSeleccionado}
      />

      {porciones.length > 0 && !diaSeleccionado && (
        <View style={estilos.centrado}>
          <PieChart porciones={porciones} size={180} />
        </View>
      )}

      {diaSeleccionado ? (
        <View style={estilos.filaTituloLista}>
          <Text style={estilos.tituloLista}>{nombreDeDia(diaSeleccionado)}</Text>
          <Pressable onPress={() => setDiaSeleccionado(null)}>
            <Text style={estilos.limpiarFiltro}>Ver todo el mes</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={estilos.tituloLista}>Todos los gastos del mes</Text>
      )}

      <FlatList
        data={gastosAMostrar}
        keyExtractor={(g) => g.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={estilos.filaGasto}>
            <View>
              <Text style={estilos.descripcionGasto}>{item.descripcion ?? item.lugar ?? 'Gasto sin descripción'}</Text>
              <Text style={estilos.fechaGasto}>{item.fecha}</Text>
            </View>
            <Text style={estilos.montoGasto}>{formatCentavos(item.centavosArs)}</Text>
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
  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg },
    contenido: { padding: spacing.md },
    selectorMes: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    flecha: { fontSize: 28, color: colors.primary, paddingHorizontal: spacing.md },
    tituloMes: { fontSize: 18, fontWeight: '700', color: colors.text1 },
    tarjetaResumen: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, marginBottom: spacing.md },
    etiqueta: { color: colors.text3, marginTop: spacing.xs },
    monto: { fontSize: 20, fontWeight: '700', color: colors.text1 },
    centrado: { alignItems: 'center', marginBottom: spacing.md },
    filaTituloLista: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    tituloLista: { color: colors.text2, fontWeight: '700', marginBottom: spacing.sm },
    limpiarFiltro: { color: colors.primary, fontWeight: '600', fontSize: 13 },
    filaGasto: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.xs },
    descripcionGasto: { color: colors.text1, fontWeight: '600' },
    fechaGasto: { color: colors.text3, fontSize: 12 },
    montoGasto: { color: colors.text1, fontWeight: '700' },
    vacio: { color: colors.text3, textAlign: 'center', marginTop: spacing.md },
  });
}
