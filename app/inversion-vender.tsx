import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useApp } from '../src/app-context';
import { useInversiones, useBrokerCash } from '../src/hooks/use-datos';
import { usePreferences } from '../src/preferences/use-preferences';
import { useCotizacionActual } from '../src/hooks/use-cotizacion-actual';
import { calcularVenta } from '../src/domain/investments';
import { venderInversion } from '../src/repos/vender-inversion';
import { formatCentavos } from '../src/domain/money';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

export default function InversionVender() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repos } = useApp();
  const inversiones = useInversiones();
  const brokerCash = useBrokerCash();
  const preferencias = usePreferences();
  const cotizacion = useCotizacionActual(preferencias.cotizacionPreferida);

  const inversion = inversiones.find((i) => i.id === id);

  const [nominalesTexto, setNominalesTexto] = useState('');
  const [precioTexto, setPrecioTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (!inversion) {
    return (
      <View style={estilos.contenedor}>
        <Text style={estilos.error}>No se encontró la inversión.</Text>
      </View>
    );
  }

  const nominalesVendidos = Number(nominalesTexto.replace(',', '.'));
  const precioVenta = Number(precioTexto.replace(',', '.'));
  const datosValidos =
    Number.isFinite(nominalesVendidos) &&
    nominalesVendidos > 0 &&
    Number.isInteger(nominalesVendidos) &&
    nominalesVendidos <= inversion.nominales &&
    Number.isFinite(precioVenta) &&
    precioVenta > 0 &&
    (inversion.monedaOriginal === 'ARS' || Boolean(cotizacion));

  const previa = datosValidos
    ? calcularVenta(inversion, nominalesVendidos, precioVenta, inversion.monedaOriginal === 'USD' ? cotizacion!.venta : null)
    : null;

  async function confirmarVenta() {
    if (!inversion) return;
    if (!Number.isFinite(nominalesVendidos) || nominalesVendidos <= 0 || !Number.isInteger(nominalesVendidos)) {
      setError('Ingresá una cantidad entera de nominales');
      return;
    }
    if (nominalesVendidos > inversion.nominales) {
      setError(`No podés vender más de ${inversion.nominales} nominales`);
      return;
    }
    if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
      setError('Ingresá un precio de venta válido');
      return;
    }
    if (inversion.monedaOriginal === 'USD' && !cotizacion) {
      setError('No se pudo obtener la cotización del dólar, probá de nuevo');
      return;
    }

    setGuardando(true);
    try {
      await venderInversion(repos, inversion, brokerCash, {
        nominalesVendidos,
        precioVenta,
        cotizacionUsada: inversion.monedaOriginal === 'USD' ? cotizacion!.venta : null,
        fecha: new Date().toISOString().slice(0, 10),
      });
      router.back();
    } catch {
      setError('No se pudo registrar la venta. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>{inversion.ticker}</Text>
      <Text style={estilos.subtitulo}>Tenés {inversion.nominales} nominales</Text>

      <Text style={estilos.etiquetaCampo}>Nominales a vender</Text>
      <TextInput
        value={nominalesTexto}
        onChangeText={(t) => {
          setNominalesTexto(t);
          setError(null);
        }}
        keyboardType="decimal-pad"
        style={estilos.inputTexto}
        placeholder={`Máximo ${inversion.nominales}`}
      />

      <Text style={estilos.etiquetaCampo}>Precio de venta ({inversion.monedaOriginal})</Text>
      <TextInput
        value={precioTexto}
        onChangeText={(t) => {
          setPrecioTexto(t);
          setError(null);
        }}
        keyboardType="decimal-pad"
        style={estilos.inputTexto}
        placeholder="Ej: 12,50"
      />

      {previa && (
        <View style={estilos.tarjetaPrevia}>
          <Text style={estilos.etiqueta}>Ingreso</Text>
          <Text style={estilos.montoPrevia}>{formatCentavos(previa.ingresoCentavosArs)}</Text>
          <Text style={estilos.etiqueta}>{previa.gananciaCentavosArs >= 0 ? 'Ganancia' : 'Pérdida'}</Text>
          <Text
            style={[
              estilos.montoPrevia,
              { color: previa.gananciaCentavosArs >= 0 ? colors.primaryDark : colors.red },
            ]}
          >
            {formatCentavos(previa.gananciaCentavosArs)}
          </Text>
        </View>
      )}

      {error && <Text style={estilos.error}>{error}</Text>}

      <Pressable style={estilos.botonGuardar} onPress={confirmarVenta} disabled={guardando}>
        <Text style={estilos.textoBotonGuardar}>{guardando ? 'Vendiendo...' : 'Confirmar venta'}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text1 },
  subtitulo: { color: colors.text3, marginBottom: spacing.md },
  etiquetaCampo: { color: colors.text2, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
  inputTexto: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface },
  tarjetaPrevia: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  etiqueta: { color: colors.text3, marginTop: spacing.xs },
  montoPrevia: { fontSize: 18, fontWeight: '700', color: colors.text1 },
  error: { color: colors.red, marginTop: spacing.sm },
  botonGuardar: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  textoBotonGuardar: { color: colors.surface, fontWeight: '700', fontSize: 16 },
});
