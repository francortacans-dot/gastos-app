import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, Alert, Platform } from 'react-native';
import { TextInputTema as TextInput } from '../../src/components/text-input-tema';
import { Toast } from '../../src/components/toast';
import { PantallaAnimada } from '../../src/components/pantalla-animada';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/app-context';
import { useInversiones, useBrokerCash, useVentas } from '../../src/hooks/use-datos';
import { usePreferences } from '../../src/preferences/use-preferences';
import { useCotizacionActual } from '../../src/hooks/use-cotizacion-actual';
import { parseAmountToCentavos, formatCentavos, usdToCentavosArs, centavosArsToUsd } from '../../src/domain/money';
import { costoTotalPosicion, costoTotalAbierto, patrimonioInversiones } from '../../src/domain/investments';
import { MoneyText } from '../../src/components/money-text';
import { IconPlus, IconTrash } from '../../src/components/icons';
import { useColors } from '../../src/theme/theme-context';
import type { Colors } from '../../src/theme/palettes';
import { spacing } from '../../src/theme/spacing';
import type { Investment, InvestmentSale } from '../../src/domain/types';
import { generarCsvPortfolio } from '../../src/domain/export-csv';
import { compartirCsv } from '../../src/services/compartir-csv';
import { parsearCsvInversiones } from '../../src/domain/import-csv-inversiones';
import { seleccionarArchivoCsv } from '../../src/services/importar-csv';
import { importarInversiones } from '../../src/repos/importar-inversiones';

export default function Inversiones() {
  const router = useRouter();
  const { repos } = useApp();
  const inversiones = useInversiones();
  const brokerCash = useBrokerCash();
  const ventas = useVentas();
  const preferencias = usePreferences();
  const cotizacion = useCotizacionActual(preferencias.cotizacionPreferida);
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const ventasOrdenadas = [...ventas].sort((a, b) => b.fecha.localeCompare(a.fecha));

  function tickerDeVenta(venta: InvestmentSale): string {
    return inversiones.find((i) => i.id === venta.investmentId)?.ticker ?? '—';
  }

  const [editandoCash, setEditandoCash] = useState(false);
  const [cashTexto, setCashTexto] = useState('');
  const [monedaEdicion, setMonedaEdicion] = useState<'ARS' | 'USD'>('ARS');
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  const abiertas = inversiones.filter((i) => i.status === 'OPEN').sort((a, b) => b.fecha.localeCompare(a.fecha));
  const costoAbierto = costoTotalAbierto(inversiones);
  const patrimonio = patrimonioInversiones(inversiones, brokerCash.centavosArs);

  async function guardarCash() {
    const monto = parseAmountToCentavos(cashTexto);
    if (monto === null) {
      setError('Ingresá un monto válido');
      return;
    }
    if (monedaEdicion === 'USD' && !cotizacion) {
      setError('No se pudo obtener la cotización del dólar, probá de nuevo');
      return;
    }
    const centavos = monedaEdicion === 'USD' ? usdToCentavosArs(monto / 100, cotizacion!.venta) : monto;
    try {
      await repos.brokerCash.guardar(centavos);
      setEditandoCash(false);
      setError(null);
    } catch {
      setError('No se pudo guardar el cash del broker. Probá de nuevo.');
    }
  }

  async function ejecutarEliminar(id: string) {
    setError(null);
    try {
      await repos.investments.eliminar(id);
    } catch {
      setError('No se pudo eliminar la inversión. Probá de nuevo.');
    }
  }

  function eliminarPosicion(id: string, ticker: string) {
    const mensaje = `¿Eliminar la posición de ${ticker}? Esta acción no se puede deshacer.`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(mensaje)) {
        ejecutarEliminar(id);
      }
      return;
    }
    Alert.alert('Eliminar inversión', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => ejecutarEliminar(id) },
    ]);
  }

  async function exportar() {
    setError(null);
    try {
      const csv = generarCsvPortfolio(inversiones, brokerCash);
      await compartirCsv(csv);
    } catch {
      setError('No se pudo exportar el CSV. Probá de nuevo.');
    }
  }

  async function importarCsv() {
    if (importando) return;
    setError(null);
    setImportando(true);
    try {
      const texto = await seleccionarArchivoCsv();
      if (texto === null) return;

      const fechaHoy = new Date().toISOString().slice(0, 10);
      const { posiciones, errores: erroresParseo } = parsearCsvInversiones(texto, fechaHoy);

      if (posiciones.length === 0 && erroresParseo.length > 0) {
        setError(`No se pudo importar: ${erroresParseo[0].motivo}`);
        return;
      }

      const { creadas, errores: erroresImportacion } = await importarInversiones(
        repos,
        posiciones,
        cotizacion?.venta ?? null
      );

      const totalErrores = erroresParseo.length + erroresImportacion.length;
      if (totalErrores === 0) {
        setError(null);
      } else {
        setError(`${creadas.length} posiciones importadas, ${totalErrores} con errores (fila ${erroresParseo[0]?.fila ?? '?'}: revisá el CSV)`);
      }
    } catch {
      setError('No se pudo importar el CSV. Probá de nuevo.');
    } finally {
      setImportando(false);
    }
  }

  function renderPosicion({ item }: { item: Investment }) {
    return (
      <View style={estilos.filaPosicion}>
        <Pressable
          style={estilos.infoPosicion}
          onPress={() => router.push({ pathname: '/inversion-vender', params: { id: item.id } })}
        >
          <Text style={estilos.ticker}>{item.ticker}</Text>
          <Text style={estilos.detalle}>
            {item.nominales} nominales · PPC {item.ppc} {item.monedaOriginal}
            {item.rubro ? ` · ${item.rubro}` : ''}
          </Text>
        </Pressable>
        <View style={estilos.accionesPosicion}>
          <MoneyText
            centavos={costoTotalPosicion(item)}
            moneda={preferencias.monedaVisualizacion}
            cotizacion={cotizacion?.venta}
            style={estilos.costoPosicion}
          />
          <View style={estilos.filaBotones}>
            <Pressable onPress={() => router.push({ pathname: '/inversion-vender', params: { id: item.id } })} style={estilos.botonVender}>
              <Text style={estilos.textoBotonVender}>Vender</Text>
            </Pressable>
            <Pressable onPress={() => eliminarPosicion(item.id, item.ticker)} hitSlop={8} style={estilos.botonBorrar}>
              <IconTrash color={colors.text4} size={16} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <PantallaAnimada style={estilos.contenedor}>
      <FlatList
        data={abiertas}
        keyExtractor={(i) => i.id}
        renderItem={renderPosicion}
        contentContainerStyle={estilos.lista}
        ListHeaderComponent={
          <View>
            <View style={estilos.filaMoneda}>
              <Pressable onPress={exportar} style={estilos.botonExportar}>
                <Text style={estilos.textoExportar}>Exportar</Text>
              </Pressable>
              <Pressable onPress={importarCsv} style={estilos.botonExportar} disabled={importando}>
                <Text style={estilos.textoExportar}>{importando ? 'Importando...' : 'Importar CSV'}</Text>
              </Pressable>
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
            </View>

            <Toast texto={error} tipo="error" colors={colors} />

            <View style={estilos.tarjetaResumen}>
              <Text style={estilos.etiqueta}>Costo invertido</Text>
              <MoneyText
                centavos={costoAbierto}
                moneda={preferencias.monedaVisualizacion}
                cotizacion={cotizacion?.venta}
                style={estilos.montoGrande}
              />

              <Text style={estilos.etiqueta}>Cash en el broker</Text>
              {editandoCash ? (
                <View style={estilos.filaEdicionCash}>
                  <Text style={estilos.etiqueta}>{monedaEdicion}</Text>
                  <TextInput
                    value={cashTexto}
                    onChangeText={setCashTexto}
                    keyboardType="decimal-pad"
                    style={estilos.inputCash}
                    placeholder="0,00"
                    autoFocus
                  />
                  <Pressable onPress={guardarCash}>
                    <Text style={estilos.linkGuardarCash}>Guardar</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    if (preferencias.monedaVisualizacion === 'USD' && !cotizacion) {
                      setError('No se pudo obtener la cotización del dólar, probá de nuevo');
                      return;
                    }
                    const monedaActual = preferencias.monedaVisualizacion;
                    const valorEnMonedaActual =
                      monedaActual === 'USD'
                        ? centavosArsToUsd(brokerCash.centavosArs, cotizacion!.venta)
                        : brokerCash.centavosArs / 100;
                    setMonedaEdicion(monedaActual);
                    setCashTexto(valorEnMonedaActual.toFixed(2).replace('.', ','));
                    setEditandoCash(true);
                  }}
                >
                  <MoneyText
                    centavos={brokerCash.centavosArs}
                    moneda={preferencias.monedaVisualizacion}
                    cotizacion={cotizacion?.venta}
                    style={estilos.montoCash}
                  />
                </Pressable>
              )}

              <Text style={estilos.etiqueta}>Patrimonio en inversiones</Text>
              <MoneyText
                centavos={patrimonio}
                moneda={preferencias.monedaVisualizacion}
                cotizacion={cotizacion?.venta}
                style={estilos.montoGrande}
              />
            </View>

            <Text style={estilos.seccionTitulo}>Posiciones abiertas</Text>
          </View>
        }
        ListEmptyComponent={<Text style={estilos.vacio}>Todavía no cargaste inversiones.</Text>}
        ListFooterComponent={
          ventasOrdenadas.length > 0 ? (
            <View style={estilos.historial}>
              <Text style={estilos.seccionTitulo}>Historial de ventas</Text>
              {ventasOrdenadas.map((v) => (
                <View key={v.id} style={estilos.filaVenta}>
                  <View>
                    <Text style={estilos.tickerVenta}>{tickerDeVenta(v)}</Text>
                    <Text style={estilos.detalle}>
                      {v.nominalesVendidos} nominales · {v.fecha}
                    </Text>
                  </View>
                  <Text style={[estilos.gananciaVenta, { color: v.gananciaCentavosArs >= 0 ? colors.primaryDark : colors.red }]}>
                    {v.gananciaCentavosArs >= 0 ? '+' : ''}
                    {formatCentavos(v.gananciaCentavosArs)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null
        }
      />

      <Pressable style={estilos.botonFlotante} onPress={() => router.push('/inversion-nueva')}>
        <IconPlus color={colors.onPrimary} size={26} />
      </Pressable>
    </PantallaAnimada>
  );
}

function crearEstilos(colors: Colors) {
  const sombra = { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as const;

  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg },
    lista: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
    filaMoneda: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    botonExportar: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    textoExportar: { color: colors.blue, fontWeight: '600' },
    grupoChip: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 20, padding: 3 },
    chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 17 },
    chipActivo: { backgroundColor: colors.primary },
    textoChip: { color: colors.text3, fontWeight: '600', fontSize: 13 },
    textoChipActivo: { color: colors.onPrimary },
    tarjetaResumen: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md, ...sombra },
    etiqueta: { color: colors.text3, marginTop: spacing.sm },
    montoGrande: { fontSize: 24, fontWeight: '700', color: colors.text1 },
    montoCash: { fontSize: 18, fontWeight: '700', color: colors.primaryDark, textDecorationLine: 'underline' },
    filaEdicionCash: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    inputCash: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.xs, backgroundColor: colors.bg },
    linkGuardarCash: { color: colors.primary, fontWeight: '700' },
    seccionTitulo: { color: colors.text2, fontWeight: '700', marginBottom: spacing.sm, fontSize: 16 },
    vacio: { color: colors.text3, textAlign: 'center', marginTop: spacing.md },
    filaPosicion: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing.sm,
      marginBottom: spacing.xs,
      ...sombra,
    },
    infoPosicion: { flex: 1 },
    ticker: { color: colors.text1, fontWeight: '700' },
    detalle: { color: colors.text3, fontSize: 12, marginTop: spacing.xs },
    accionesPosicion: { alignItems: 'flex-end' },
    costoPosicion: { fontWeight: '700', color: colors.text1 },
    filaBotones: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
    botonVender: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
    textoBotonVender: { color: colors.primary, fontWeight: '600', fontSize: 13 },
    botonBorrar: { padding: 4 },
    historial: { marginTop: spacing.lg },
    filaVenta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing.sm,
      marginBottom: spacing.xs,
      ...sombra,
    },
    tickerVenta: { color: colors.text1, fontWeight: '700' },
    gananciaVenta: { fontWeight: '700' },
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
  });
}
