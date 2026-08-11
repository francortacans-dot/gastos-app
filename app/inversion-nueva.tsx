import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TextInputTema as TextInput } from '../src/components/text-input-tema';
import { Toast } from '../src/components/toast';
import { BottomSheet } from '../src/components/bottom-sheet';
import { useRouter } from 'expo-router';
import { useApp } from '../src/app-context';
import { usePreferences } from '../src/preferences/use-preferences';
import { useCotizacionActual } from '../src/hooks/use-cotizacion-actual';
import { costoUnitarioCentavosArs } from '../src/domain/investments';
import type { Currency } from '../src/domain/types';
import { useColors } from '../src/theme/theme-context';
import type { Colors } from '../src/theme/palettes';
import { spacing } from '../src/theme/spacing';

export default function InversionNueva() {
  const router = useRouter();
  const { repos } = useApp();
  const preferencias = usePreferences();
  const cotizacion = useCotizacionActual(preferencias.cotizacionPreferida);
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const [ticker, setTicker] = useState('');
  const [nominalesTexto, setNominalesTexto] = useState('');
  const [ppcTexto, setPpcTexto] = useState('');
  const [moneda, setMoneda] = useState<Currency>('ARS');
  const [rubro, setRubro] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const nominales = Number(nominalesTexto.replace(',', '.'));
    const ppc = Number(ppcTexto.replace(',', '.'));

    if (!ticker.trim()) {
      setError('Ingresá un ticker');
      return;
    }
    if (!Number.isFinite(nominales) || nominales <= 0 || !Number.isInteger(nominales)) {
      setError('Ingresá una cantidad entera de nominales');
      return;
    }
    if (!Number.isFinite(ppc) || ppc <= 0) {
      setError('Ingresá un PPC válido');
      return;
    }
    if (moneda === 'USD' && !cotizacion) {
      setError('No se pudo obtener la cotización del dólar, probá de nuevo');
      return;
    }

    const cotizacionUsada = moneda === 'USD' ? cotizacion!.venta : null;

    setGuardando(true);
    try {
      await repos.investments.agregar({
        ticker: ticker.trim().toUpperCase(),
        nominales,
        ppc,
        monedaOriginal: moneda,
        cotizacionUsada,
        costoCentavosArsUnitario: costoUnitarioCentavosArs(ppc, moneda, cotizacionUsada),
        rubro: rubro.trim() || null,
        fecha: new Date().toISOString().slice(0, 10),
        status: 'OPEN',
      });
      router.back();
    } catch {
      setError('No se pudo guardar la inversión. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <BottomSheet titulo="Nueva inversión" onCerrar={() => router.back()}>
      <Text style={estilos.etiquetaCampo}>Ticker</Text>
      <TextInput value={ticker} onChangeText={setTicker} style={estilos.inputTexto} placeholder="Ej: GOOGL" autoCapitalize="characters" />

      <Text style={estilos.etiquetaCampo}>Nominales</Text>
      <TextInput
        value={nominalesTexto}
        onChangeText={setNominalesTexto}
        style={estilos.inputTexto}
        placeholder="Ej: 10"
        keyboardType="number-pad"
      />

      <Text style={estilos.etiquetaCampo}>PPC (precio promedio de compra)</Text>
      <TextInput
        value={ppcTexto}
        onChangeText={setPpcTexto}
        style={estilos.inputTexto}
        placeholder="Ej: 9,42"
        keyboardType="decimal-pad"
      />

      <Text style={estilos.etiquetaCampo}>Moneda</Text>
      <View style={estilos.filaChips}>
        {(['ARS', 'USD'] as Currency[]).map((m) => (
          <Pressable key={m} onPress={() => setMoneda(m)} style={[estilos.chip, moneda === m && estilos.chipActivo]}>
            <Text style={[estilos.textoChip, moneda === m && estilos.textoChipActivo]}>{m}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={estilos.etiquetaCampo}>Rubro (opcional)</Text>
      <TextInput value={rubro} onChangeText={setRubro} style={estilos.inputTexto} placeholder="Ej: Tech" />

      <Toast texto={error} tipo="error" colors={colors} />

      <Pressable style={estilos.botonGuardar} onPress={guardar} disabled={guardando}>
        <Text style={estilos.textoBotonGuardar}>{guardando ? 'Guardando...' : 'Guardar inversión'}</Text>
      </Pressable>
    </BottomSheet>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    etiquetaCampo: { color: colors.text2, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
    inputTexto: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface },
    filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    chipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    textoChip: { color: colors.text2 },
    textoChipActivo: { color: colors.onPrimary },
    botonGuardar: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
    textoBotonGuardar: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  });
}
