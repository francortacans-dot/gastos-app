import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/app-context';
import { useInversiones, useBrokerCash } from '../../src/hooks/use-datos';
import { usePreferences } from '../../src/preferences/use-preferences';
import { useCotizacionActual } from '../../src/hooks/use-cotizacion-actual';
import { parseAmountToCentavos } from '../../src/domain/money';
import { costoTotalPosicion, costoTotalAbierto, patrimonioInversiones } from '../../src/domain/investments';
import { MoneyText } from '../../src/components/money-text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import type { Investment } from '../../src/domain/types';

export default function Inversiones() {
  const router = useRouter();
  const { repos } = useApp();
  const inversiones = useInversiones();
  const brokerCash = useBrokerCash();
  const preferencias = usePreferences();
  const cotizacion = useCotizacionActual(preferencias.cotizacionPreferida);

  const [editandoCash, setEditandoCash] = useState(false);
  const [cashTexto, setCashTexto] = useState('');

  const abiertas = inversiones.filter((i) => i.status === 'OPEN').sort((a, b) => b.fecha.localeCompare(a.fecha));
  const costoAbierto = costoTotalAbierto(inversiones);
  const patrimonio = patrimonioInversiones(inversiones, brokerCash.centavosArs);

  async function guardarCash() {
    const centavos = parseAmountToCentavos(cashTexto);
    if (centavos === null) return;
    await repos.brokerCash.guardar(centavos);
    setEditandoCash(false);
  }

  async function eliminarPosicion(id: string) {
    await repos.investments.eliminar(id);
  }

  function renderPosicion({ item }: { item: Investment }) {
    return (
      <View style={estilos.filaPosicion}>
        <View style={estilos.infoPosicion}>
          <Text style={estilos.ticker}>{item.ticker}</Text>
          <Text style={estilos.detalle}>
            {item.nominales} nominales · PPC {item.ppc} {item.monedaOriginal}
            {item.rubro ? ` · ${item.rubro}` : ''}
          </Text>
        </View>
        <View style={estilos.accionesPosicion}>
          <MoneyText
            centavos={costoTotalPosicion(item)}
            moneda={preferencias.monedaVisualizacion}
            cotizacion={cotizacion?.venta}
            style={estilos.costoPosicion}
          />
          <View style={estilos.filaBotones}>
            <Pressable onPress={() => router.push({ pathname: '/inversion-vender', params: { id: item.id } })}>
              <Text style={estilos.linkVender}>Vender</Text>
            </Pressable>
            <Pressable onPress={() => eliminarPosicion(item.id)}>
              <Text style={estilos.linkEliminar}>Eliminar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={estilos.contenedor}>
      <FlatList
        data={abiertas}
        keyExtractor={(i) => i.id}
        renderItem={renderPosicion}
        contentContainerStyle={estilos.lista}
        ListHeaderComponent={
          <View>
            <View style={estilos.filaMoneda}>
              <Pressable onPress={() => preferencias.setMonedaVisualizacion('ARS')}>
                <Text style={[estilos.toggle, preferencias.monedaVisualizacion === 'ARS' && estilos.toggleActivo]}>ARS</Text>
              </Pressable>
              <Pressable onPress={() => preferencias.setMonedaVisualizacion('USD')}>
                <Text style={[estilos.toggle, preferencias.monedaVisualizacion === 'USD' && estilos.toggleActivo]}>USD</Text>
              </Pressable>
            </View>

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
                    setCashTexto(String(brokerCash.centavosArs / 100).replace('.', ','));
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
      />

      <Pressable style={estilos.botonFlotante} onPress={() => router.push('/inversion-nueva')}>
        <Text style={estilos.textoBotonFlotante}>+</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg },
  lista: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
  filaMoneda: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm },
  toggle: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, color: colors.text3, fontWeight: '600' },
  toggleActivo: { color: colors.primary, textDecorationLine: 'underline' },
  tarjetaResumen: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
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
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  infoPosicion: { flex: 1 },
  ticker: { color: colors.text1, fontWeight: '700' },
  detalle: { color: colors.text3, fontSize: 12, marginTop: spacing.xs },
  accionesPosicion: { alignItems: 'flex-end' },
  costoPosicion: { fontWeight: '700' },
  filaBotones: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  linkVender: { color: colors.primary, fontWeight: '600' },
  linkEliminar: { color: colors.red, fontWeight: '600' },
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
