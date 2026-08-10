import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TextInputTema as TextInput } from '../src/components/text-input-tema';
import { Toast } from '../src/components/toast';
import { BottomSheet } from '../src/components/bottom-sheet';
import { useRouter } from 'expo-router';
import { useApp } from '../src/app-context';
import { useSectores } from '../src/hooks/use-datos';
import { parseAmountToCentavos } from '../src/domain/money';
import { useColors } from '../src/theme/theme-context';
import type { Colors } from '../src/theme/palettes';
import { spacing } from '../src/theme/spacing';

const METODOS_SUGERIDOS: string[] = [
  'Efectivo',
  'Débito',
  'Crédito',
  'Transferencia',
  'Mercado Pago',
  'Brubank',
  'Ualá',
  'Naranja X',
];

export default function GastoNuevo() {
  const router = useRouter();
  const { repos } = useApp();
  const sectores = useSectores();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const [montoTexto, setMontoTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [lugar, setLugar] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [metodoPago, setMetodoPago] = useState<string | null>(null);
  const [metodoPersonalizado, setMetodoPersonalizado] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const centavos = parseAmountToCentavos(montoTexto);
    if (centavos === null || centavos === 0) {
      setError('Ingresá un monto válido');
      return;
    }

    setGuardando(true);
    try {
      await repos.expenses.agregar({
        centavosArs: centavos,
        montoOriginal: centavos / 100,
        monedaOriginal: 'ARS',
        cotizacionUsada: null,
        fecha: new Date().toISOString().slice(0, 10),
        sectorId,
        lugar: lugar.trim() || null,
        descripcion: descripcion.trim() || null,
        metodoPago: metodoPersonalizado.trim() || metodoPago,
      });
      router.back();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <BottomSheet titulo="Nuevo gasto" onCerrar={() => router.back()}>
      <TextInput
        value={montoTexto}
        onChangeText={(t) => {
          setMontoTexto(t);
          setError(null);
        }}
        placeholder="0,00"
        keyboardType="decimal-pad"
        style={estilos.inputMonto}
        autoFocus
      />
      <Toast texto={error} tipo="error" colors={colors} />

      <View style={estilos.opcionales}>
        <Text style={estilos.etiquetaCampo}>Sector</Text>
        <View style={estilos.filaChips}>
          {sectores.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSectorId(sectorId === s.id ? null : s.id)}
              style={[estilos.chip, { borderColor: s.color }, sectorId === s.id && { backgroundColor: s.color }]}
            >
              <Text style={[estilos.textoChip, sectorId === s.id && { color: colors.onPrimary }]}>{s.nombre}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={estilos.etiquetaCampo}>Lugar</Text>
        <TextInput value={lugar} onChangeText={setLugar} style={estilos.inputTexto} placeholder="Ej: Supermercado" />

        <Text style={estilos.etiquetaCampo}>Descripción</Text>
        <TextInput value={descripcion} onChangeText={setDescripcion} style={estilos.inputTexto} placeholder="Ej: Compra del mes" />

        <Text style={estilos.etiquetaCampo}>Método de pago</Text>
        <View style={estilos.filaChips}>
          {METODOS_SUGERIDOS.map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                setMetodoPago(metodoPago === m ? null : m);
                setMetodoPersonalizado('');
              }}
              style={[estilos.chip, { borderColor: colors.border }, metodoPago === m && { backgroundColor: colors.primary }]}
            >
              <Text style={[estilos.textoChip, metodoPago === m && { color: colors.onPrimary }]}>{m}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={metodoPersonalizado}
          onChangeText={(t) => {
            setMetodoPersonalizado(t);
            if (t) setMetodoPago(null);
          }}
          style={estilos.inputTexto}
          placeholder="Otro medio de pago (opcional)"
        />
      </View>

      <Pressable style={estilos.botonGuardar} onPress={guardar} disabled={guardando}>
        <Text style={estilos.textoBotonGuardar}>{guardando ? 'Guardando...' : 'Guardar gasto'}</Text>
      </Pressable>
    </BottomSheet>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    inputMonto: { fontSize: 40, fontWeight: '700', color: colors.text1, textAlign: 'center', marginBottom: spacing.sm },
    opcionales: { marginTop: spacing.sm, marginBottom: spacing.lg },
    etiquetaCampo: { color: colors.text2, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
    filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
    chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    textoChip: { color: colors.text2 },
    inputTexto: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface },
    botonGuardar: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.md, alignItems: 'center' },
    textoBotonGuardar: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  });
}
