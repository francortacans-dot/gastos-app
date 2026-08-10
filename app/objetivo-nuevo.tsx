import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TextInputTema as TextInput } from '../src/components/text-input-tema';
import { Toast } from '../src/components/toast';
import { BottomSheet } from '../src/components/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../src/app-context';
import { useObjetivos } from '../src/hooks/use-datos';
import { parseAmountToCentavos } from '../src/domain/money';
import type { TamanoObjetivo } from '../src/domain/types';
import { useColors } from '../src/theme/theme-context';
import type { Colors } from '../src/theme/palettes';
import { spacing } from '../src/theme/spacing';

const TAMANOS: { valor: TamanoObjetivo; etiqueta: string }[] = [
  { valor: 'chico', etiqueta: 'Chico' },
  { valor: 'mediano', etiqueta: 'Mediano' },
  { valor: 'grande', etiqueta: 'Grande' },
];

export default function ObjetivoNuevo() {
  const router = useRouter();
  const { repos } = useApp();
  const objetivos = useObjetivos();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const { id } = useLocalSearchParams<{ id?: string }>();
  const existente = id ? objetivos.find((o) => o.id === id) ?? null : null;
  const editando = existente !== null;

  const [nombre, setNombre] = useState(existente?.nombre ?? '');
  const [metaTexto, setMetaTexto] = useState(
    existente ? String(existente.montoMetaCentavos / 100).replace('.', ',') : ''
  );
  const [actualTexto, setActualTexto] = useState(
    existente?.montoActualCentavos ? String(existente.montoActualCentavos / 100).replace('.', ',') : ''
  );
  const [fecha, setFecha] = useState(existente?.fechaObjetivo ?? '');
  const [tamano, setTamano] = useState<TamanoObjetivo>(existente?.tamano ?? 'mediano');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const montoMetaCentavos = parseAmountToCentavos(metaTexto);
    if (!nombre.trim() || montoMetaCentavos === null || montoMetaCentavos <= 0) {
      setError('Ingresá un nombre y un monto meta válido');
      return;
    }
    const montoActualCentavos = actualTexto.trim() ? (parseAmountToCentavos(actualTexto) ?? 0) : 0;
    const fechaObjetivo = /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim()) ? fecha.trim() : null;

    setGuardando(true);
    try {
      if (existente) {
        await repos.goals.guardar({ id: existente.id, nombre: nombre.trim(), montoMetaCentavos, montoActualCentavos, fechaObjetivo, tamano });
      } else {
        await repos.goals.guardar({ nombre: nombre.trim(), montoMetaCentavos, montoActualCentavos, fechaObjetivo, tamano });
      }
      router.back();
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!existente) return;
    await repos.goals.eliminar(existente.id);
    router.back();
  }

  return (
    <BottomSheet titulo={editando ? 'Editar objetivo' : 'Nuevo objetivo'} onCerrar={() => router.back()}>
      <Text style={estilos.etiquetaCampo}>Nombre</Text>
      <TextInput value={nombre} onChangeText={setNombre} placeholder="Ej: Viaje a Bariloche" style={estilos.input} autoFocus />

      <Text style={estilos.etiquetaCampo}>Monto meta</Text>
      <TextInput value={metaTexto} onChangeText={setMetaTexto} placeholder="Ej: 500000" keyboardType="decimal-pad" style={estilos.input} />

      <Text style={estilos.etiquetaCampo}>Ya ahorrado (opcional)</Text>
      <TextInput value={actualTexto} onChangeText={setActualTexto} placeholder="Ej: 50000" keyboardType="decimal-pad" style={estilos.input} />

      <Text style={estilos.etiquetaCampo}>Fecha objetivo (opcional)</Text>
      <TextInput value={fecha} onChangeText={setFecha} placeholder="AAAA-MM-DD" style={estilos.input} />

      <Text style={estilos.etiquetaCampo}>Tamaño</Text>
      <View style={estilos.filaChips}>
        {TAMANOS.map((t) => (
          <Pressable
            key={t.valor}
            onPress={() => setTamano(t.valor)}
            style={[estilos.chip, tamano === t.valor && estilos.chipActivo]}
          >
            <Text style={[estilos.textoChip, tamano === t.valor && estilos.textoChipActivo]}>{t.etiqueta}</Text>
          </Pressable>
        ))}
      </View>

      <Toast texto={error} tipo="error" colors={colors} />

      <Pressable style={estilos.boton} onPress={guardar} disabled={guardando}>
        <Text style={estilos.textoBoton}>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear objetivo'}</Text>
      </Pressable>

      {editando && (
        <Pressable style={estilos.botonBorrar} onPress={eliminar}>
          <Text style={estilos.textoBotonBorrar}>Borrar objetivo</Text>
        </Pressable>
      )}
    </BottomSheet>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    etiquetaCampo: { color: colors.text2, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface },
    filaChips: { flexDirection: 'row', gap: spacing.xs },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    chipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    textoChip: { color: colors.text2, fontWeight: '600' },
    textoChipActivo: { color: colors.onPrimary },
    boton: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
    textoBoton: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
    botonBorrar: { alignItems: 'center', padding: spacing.md },
    textoBotonBorrar: { color: colors.red, fontWeight: '600' },
  });
}
