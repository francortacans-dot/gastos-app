import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/app-context';
import { useMesActual } from '../../src/hooks/use-mes-actual';
import { useResumenMes } from '../../src/hooks/use-resumen-mes';
import { useSectores } from '../../src/hooks/use-datos';
import { useGastos } from '../../src/hooks/use-datos';
import { useCotizacionActual } from '../../src/hooks/use-cotizacion-actual';
import { usePreferences } from '../../src/preferences/use-preferences';
import { gastadoPorSector, SIN_SECTOR } from '../../src/domain/budget';
import { formatCentavos, parseAmountToCentavos } from '../../src/domain/money';
import { PieChart } from '../../src/components/pie-chart';
import { SectorProgress } from '../../src/components/sector-progress';
import { MoneyText } from '../../src/components/money-text';
import { IconPlus, IconPencil } from '../../src/components/icons';
import { useColors } from '../../src/theme/theme-context';
import type { Colors } from '../../src/theme/palettes';
import { spacing } from '../../src/theme/spacing';
import { useEsEscritorio } from '../../src/hooks/use-es-escritorio';

export default function Home() {
  const router = useRouter();
  const { repos } = useApp();
  const { mes } = useMesActual();
  const resumen = useResumenMes(mes);
  const sectores = useSectores();
  const gastos = useGastos();
  const preferencias = usePreferences();
  const cotizacion = useCotizacionActual(preferencias.cotizacionPreferida);
  const esEscritorio = useEsEscritorio();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const [editandoPresupuesto, setEditandoPresupuesto] = useState(false);
  const [presupuestoTexto, setPresupuestoTexto] = useState('');

  function abrirEdicionPresupuesto() {
    setPresupuestoTexto(resumen.presupuestoDelMes > 0 ? String(resumen.presupuestoDelMes / 100).replace('.', ',') : '');
    setEditandoPresupuesto(true);
  }

  async function guardarPresupuesto() {
    const centavos = parseAmountToCentavos(presupuestoTexto);
    if (centavos === null) return;
    await repos.budgets.guardar({ mes, totalCentavos: centavos });
    setEditandoPresupuesto(false);
  }

  const gastoPorSector = gastadoPorSector(gastos, mes);
  const porciones = [
    ...sectores.map((s) => ({ etiqueta: s.nombre, valor: gastoPorSector.get(s.id) ?? 0, color: s.color })),
    { etiqueta: 'Sin sector', valor: gastoPorSector.get(SIN_SECTOR) ?? 0, color: colors.text4 },
  ].filter((p) => p.valor > 0);

  const ultimosGastos = [...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);

  const controles = (
    <View style={estilos.filaControles}>
      <View style={estilos.grupoChip}>
        {(['ARS', 'USD'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => preferencias.setMonedaVisualizacion(m)}
            style={[estilos.chip, preferencias.monedaVisualizacion === m && estilos.chipActivo]}
          >
            <Text style={[estilos.textoChip, preferencias.monedaVisualizacion === m && estilos.textoChipActivo]}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <View style={estilos.grupoChip}>
        {(['oficial', 'blue'] as const).map((c) => (
          <Pressable
            key={c}
            onPress={() => preferencias.setCotizacionPreferida(c)}
            style={[estilos.chip, preferencias.cotizacionPreferida === c && estilos.chipActivo]}
          >
            <Text style={[estilos.textoChip, preferencias.cotizacionPreferida === c && estilos.textoChipActivo]}>
              {c === 'oficial' ? 'Oficial' : 'Blue'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const tarjetaResumen = (
    <View style={estilos.tarjetaResumen}>
      <View style={estilos.acentoTarjeta} />
      <Text style={estilos.etiqueta}>Disponible este mes</Text>
      <MoneyText
        centavos={resumen.disponible}
        moneda={preferencias.monedaVisualizacion}
        cotizacion={cotizacion?.venta}
        style={estilos.montoGrande}
      />
      <View style={estilos.filaDetalle}>
        <View style={estilos.detalleConEditar}>
          <Text style={estilos.detalle}>
            Presupuesto: <MoneyText centavos={resumen.presupuestoDelMes} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} />
          </Text>
          <Pressable onPress={abrirEdicionPresupuesto} hitSlop={8} style={estilos.botonLapiz}>
            <IconPencil color={colors.text3} size={14} />
          </Pressable>
        </View>
        <Text style={estilos.detalle}>
          Gastado: <MoneyText centavos={resumen.gastado} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} />
        </Text>
      </View>

      {editandoPresupuesto && (
        <View style={estilos.filaEdicion}>
          <TextInput
            value={presupuestoTexto}
            onChangeText={setPresupuestoTexto}
            keyboardType="decimal-pad"
            placeholder="Ej: 150000"
            style={estilos.inputPresupuesto}
            autoFocus
          />
          <Pressable style={estilos.botonChico} onPress={guardarPresupuesto}>
            <Text style={estilos.textoBotonChico}>Guardar</Text>
          </Pressable>
        </View>
      )}

      {resumen.acumuladoPrevio > 0 && (
        <Pressable style={estilos.chipAcumulado} onPress={() => router.push('/(tabs)/ahorro')}>
          <Text style={estilos.textoChipAcumulado}>
            +<MoneyText centavos={resumen.acumuladoPrevio} moneda="ARS" style={estilos.textoChipAcumulado} /> de meses anteriores
          </Text>
        </Pressable>
      )}
    </View>
  );

  const botonFlotante = (
    <Pressable style={estilos.botonFlotante} onPress={() => router.push('/gasto-nuevo')}>
      <IconPlus color={colors.surface} size={26} />
    </Pressable>
  );

  if (esEscritorio) {
    return (
      <View style={estilos.contenedorEscritorio}>
        <ScrollView style={estilos.columnaIzquierda} contentContainerStyle={estilos.contenido}>
          {controles}
          {tarjetaResumen}
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
        {botonFlotante}
      </View>
    );
  }

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      {controles}
      {tarjetaResumen}

      {porciones.length > 0 && (
        <View style={estilos.centrado}>
          <PieChart porciones={porciones} size={220} />
        </View>
      )}

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

      {botonFlotante}
    </ScrollView>
  );
}

function crearEstilos(colors: Colors) {
  const sombra = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  } as const;

  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg },
    contenido: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
    filaControles: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
    grupoChip: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 20, padding: 3 },
    chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 17 },
    chipActivo: { backgroundColor: colors.primary },
    textoChip: { color: colors.text3, fontWeight: '600', fontSize: 13 },
    textoChipActivo: { color: colors.surface },
    tarjetaResumen: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
      ...sombra,
    },
    acentoTarjeta: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.primary },
    etiqueta: { color: colors.text3, marginBottom: spacing.xs },
    montoGrande: { fontSize: 36, fontWeight: '700', color: colors.text1 },
    filaDetalle: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, alignItems: 'center' },
    detalleConEditar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detalle: { color: colors.text2 },
    botonLapiz: { padding: 4 },
    filaEdicion: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
    inputPresupuesto: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: spacing.xs,
      backgroundColor: colors.surface2,
    },
    botonChico: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: spacing.sm, justifyContent: 'center' },
    textoBotonChico: { color: colors.surface, fontWeight: '600', fontSize: 13 },
    chipAcumulado: { marginTop: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
    textoChipAcumulado: { color: colors.primaryDark, fontWeight: '600' },
    centrado: { alignItems: 'center', marginBottom: spacing.md },
    seccion: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md, ...sombra },
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
    contenedorEscritorio: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
    columnaIzquierda: { flex: 1, borderRightWidth: 1, borderRightColor: colors.border },
    columnaDerecha: { flex: 1 },
    seccionTitulo: { color: colors.text2, fontWeight: '700', marginBottom: spacing.sm, fontSize: 16 },
  });
}
