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
import { calcularAngulos } from '../../src/components/pie-chart-math';
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
  const leyendaPorciones = calcularAngulos(porciones);
  const leyendaPorcionesAnio = calcularAngulos(porcionesAnio);
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
              <Leyenda porciones={leyendaPorciones} estilos={estilos} />
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
              <Leyenda porciones={leyendaPorcionesAnio} estilos={estilos} />
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

function Leyenda({
  porciones,
  estilos,
}: {
  porciones: ReturnType<typeof calcularAngulos>;
  estilos: ReturnType<typeof crearEstilos>;
}) {
  return (
    <View style={estilos.leyenda}>
      {porciones.map((p) => (
        <View key={p.etiqueta} style={estilos.filaLeyenda}>
          <View style={[estilos.puntoLeyenda, { backgroundColor: p.color }]} />
          <Text style={estilos.textoLeyenda}>{p.etiqueta}</Text>
          <Text style={estilos.porcentajeLeyenda}>{p.porcentaje.toFixed(0)}%</Text>
        </View>
      ))}
    </View>
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
    leyenda: { marginTop: spacing.sm, alignSelf: 'stretch' },
    filaLeyenda: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: spacing.xs },
    puntoLeyenda: { width: 10, height: 10, borderRadius: 5 },
    textoLeyenda: { flex: 1, color: colors.text2, fontSize: 13 },
    porcentajeLeyenda: { color: colors.text1, fontWeight: '700', fontSize: 13 },
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
