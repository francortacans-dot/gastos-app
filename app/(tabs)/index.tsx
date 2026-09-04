import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { TextInputTema as TextInput } from '../../src/components/text-input-tema';
import { Toast } from '../../src/components/toast';
import { PantallaAnimada } from '../../src/components/pantalla-animada';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/app-context';
import { useMesActual } from '../../src/hooks/use-mes-actual';
import { useResumenMes } from '../../src/hooks/use-resumen-mes';
import { useSectores, useObjetivos, useAhorros } from '../../src/hooks/use-datos';
import { useGastos } from '../../src/hooks/use-datos';
import { eliminarGasto } from '../../src/repos/eliminar-gasto';
import { useCotizacionActual } from '../../src/hooks/use-cotizacion-actual';
import { usePreferences } from '../../src/preferences/use-preferences';
import { gastadoPorSector, SIN_SECTOR } from '../../src/domain/budget';
import { elegirObjetivoDestacado, porcentajeObjetivo } from '../../src/domain/objetivos';
import { formatCentavos, parseAmountToCentavos } from '../../src/domain/money';
import { PieChart } from '../../src/components/pie-chart';
import { SectorProgress } from '../../src/components/sector-progress';
import { MoneyText } from '../../src/components/money-text';
import { IconPlus, IconPencil, IconWallet, IconTrash } from '../../src/components/icons';
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
  const objetivos = useObjetivos();
  const gastos = useGastos();
  const movimientos = useAhorros();
  const preferencias = usePreferences();
  const cotizacion = useCotizacionActual(preferencias.cotizacionPreferida);
  const esEscritorio = useEsEscritorio();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const [editandoPresupuesto, setEditandoPresupuesto] = useState(false);
  const [presupuestoTexto, setPresupuestoTexto] = useState('');
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);

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

  async function borrarGasto(gasto: (typeof gastos)[number]) {
    setErrorBorrado(null);
    try {
      await eliminarGasto(repos, gasto, movimientos);
    } catch {
      setErrorBorrado('No se pudo borrar el gasto. Probá de nuevo.');
    }
  }

  const gastoPorSector = gastadoPorSector(gastos, mes);
  const porciones = [
    ...sectores.map((s) => ({ etiqueta: s.nombre, valor: gastoPorSector.get(s.id) ?? 0, color: s.color })),
    { etiqueta: 'Sin sector', valor: gastoPorSector.get(SIN_SECTOR) ?? 0, color: colors.text4 },
  ].filter((p) => p.valor > 0);

  const ultimosGastos = [...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);
  const objetivoDestacado = elegirObjetivoDestacado(objetivos);

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
      <View style={estilos.grupoCotizacion}>
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
        {cotizacion && <Text style={estilos.textoCotizacion}>$ {cotizacion.venta.toLocaleString('es-AR')}</Text>}
      </View>
    </View>
  );

  const tarjetaResumen = (
    <View style={estilos.tarjetaResumen}>
      <View style={estilos.filaEncabezadoTarjeta}>
        <Text style={estilos.etiqueta}>Disponible este mes</Text>
        <IconWallet color={colors.onPrimary} size={20} />
      </View>
      <MoneyText
        centavos={resumen.disponible}
        moneda={preferencias.monedaVisualizacion}
        cotizacion={cotizacion?.venta}
        style={estilos.montoGrande}
      />
      <View style={estilos.filaDetalle}>
        <View style={estilos.detalleConEditar}>
          <Text style={estilos.detalle}>
            Presupuesto: <MoneyText centavos={resumen.presupuestoDelMes} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} style={estilos.detalle} />
          </Text>
          <Pressable onPress={abrirEdicionPresupuesto} hitSlop={8} style={estilos.botonLapiz}>
            <IconPencil color={colors.onPrimary} size={14} />
          </Pressable>
        </View>
        <Text style={estilos.detalle}>
          Gastado: <MoneyText centavos={resumen.gastado} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} style={estilos.detalle} />
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
            +<MoneyText centavos={resumen.acumuladoPrevio} moneda="ARS" style={estilos.textoChipAcumulado} /> de meses
            anteriores
          </Text>
        </Pressable>
      )}
    </View>
  );

  const tarjetaObjetivo = objetivoDestacado && (
    <Pressable style={estilos.tarjetaObjetivo} onPress={() => router.push('/(tabs)/ahorro')}>
      <View style={estilos.filaObjetivoTitulo}>
        <Text style={estilos.etiquetaObjetivo}>Próximo objetivo</Text>
        <Text style={estilos.nombreObjetivo}>{objetivoDestacado.nombre}</Text>
      </View>
      <View style={estilos.barraFondoObjetivo}>
        <View style={[estilos.barraRellenoObjetivo, { width: `${porcentajeObjetivo(objetivoDestacado)}%` }]} />
      </View>
      <View style={estilos.filaObjetivoTitulo}>
        <Text style={estilos.montoObjetivo}>
          {formatCentavos(objetivoDestacado.montoActualCentavos)} de {formatCentavos(objetivoDestacado.montoMetaCentavos)}
        </Text>
        <Text style={estilos.porcentajeObjetivo}>{porcentajeObjetivo(objetivoDestacado)}%</Text>
      </View>
    </Pressable>
  );

  const botonFlotante = (
    <Pressable style={estilos.botonFlotante} onPress={() => router.push('/gasto-nuevo')}>
      <IconPlus color={colors.onPrimary} size={26} />
    </Pressable>
  );

  if (esEscritorio) {
    return (
      <PantallaAnimada style={estilos.contenedorEscritorio}>
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
          {tarjetaObjetivo}
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
        </ScrollView>
        {botonFlotante}
      </PantallaAnimada>
    );
  }

  return (
    <PantallaAnimada>
      <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
        {controles}
        {tarjetaResumen}

      {porciones.length > 0 && (
        <View style={estilos.centrado}>
          <PieChart porciones={porciones} size={220} />
        </View>
      )}

      {tarjetaObjetivo}

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
    </PantallaAnimada>
  );
}

function crearEstilos(colors: Colors) {
  // boxShadow en vez de las props shadow*, que están deprecadas y no renderizan en web.
  const sombra = { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as const;

  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg },
    contenido: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
    filaControles: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
    grupoCotizacion: { alignItems: 'flex-end', gap: 4 },
    textoCotizacion: { color: colors.text3, fontSize: 12, fontWeight: '600' },
    grupoChip: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 20, padding: 3 },
    chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 17 },
    chipActivo: { backgroundColor: colors.primary },
    textoChip: { color: colors.text3, fontWeight: '600', fontSize: 13 },
    textoChipActivo: { color: colors.onPrimary },
    tarjetaResumen: {
      // Tarjeta hero de color sólido con el acento del tema: es la única superficie
      // coloreada de la pantalla a propósito, para que resalte sin sobrecargar el resto.
      backgroundColor: colors.primary,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
      ...sombra,
    },
    filaEncabezadoTarjeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
    // Blanco translúcido en vez de un token de la paleta: es un overlay funcional para
    // legibilidad sobre `primary` (que cambia de tono según el tema), no un color nuevo.
    etiqueta: { color: 'rgba(255,255,255,0.85)' },
    montoGrande: { fontSize: 36, fontWeight: '700', color: colors.onPrimary },
    filaDetalle: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, alignItems: 'center' },
    detalleConEditar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detalle: { color: 'rgba(255,255,255,0.85)' },
    botonLapiz: { padding: 4 },
    filaEdicion: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
    inputPresupuesto: {
      flex: 1,
      borderRadius: 8,
      padding: spacing.xs,
      backgroundColor: colors.surface,
    },
    botonChico: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: spacing.sm, justifyContent: 'center' },
    textoBotonChico: { color: colors.primary, fontWeight: '600', fontSize: 13 },
    chipAcumulado: { marginTop: spacing.sm, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
    textoChipAcumulado: { color: colors.onPrimary, fontWeight: '600' },
    centrado: { alignItems: 'center', marginBottom: spacing.md },
    tarjetaObjetivo: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, marginBottom: spacing.md, ...sombra },
    filaObjetivoTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    etiquetaObjetivo: { color: colors.text3, fontSize: 12 },
    nombreObjetivo: { color: colors.text1, fontWeight: '700' },
    barraFondoObjetivo: { height: 8, borderRadius: 4, backgroundColor: colors.surface2, overflow: 'hidden', marginVertical: spacing.xs },
    barraRellenoObjetivo: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
    montoObjetivo: { color: colors.text2, fontSize: 13 },
    porcentajeObjetivo: { color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
    seccion: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md, ...sombra },
    vacio: { color: colors.text3 },
    filaGasto: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
    botonBorrarGasto: { padding: 4 },
    infoGasto: { flex: 1 },
    descripcionGasto: { color: colors.text1, fontWeight: '600' },
    fechaGasto: { color: colors.text3, fontSize: 12 },
    etiquetaAhorro: { color: colors.text3, fontSize: 11 },
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
      boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
    },
    contenedorEscritorio: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
    columnaIzquierda: { flex: 1, borderRightWidth: 1, borderRightColor: colors.border },
    columnaDerecha: { flex: 1 },
    seccionTitulo: { color: colors.text2, fontWeight: '700', marginBottom: spacing.sm, fontSize: 16 },
  });
}
