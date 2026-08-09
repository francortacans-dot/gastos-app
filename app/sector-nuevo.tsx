import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TextInputTema as TextInput } from '../src/components/text-input-tema';
import { Toast } from '../src/components/toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../src/app-context';
import { useSectores } from '../src/hooks/use-datos';
import { sectorPalette } from '../src/theme/colors';
import { parseAmountToCentavos } from '../src/domain/money';
import { useColors } from '../src/theme/theme-context';
import type { Colors } from '../src/theme/palettes';
import { spacing } from '../src/theme/spacing';

export default function SectorNuevo() {
  const router = useRouter();
  const { repos } = useApp();
  const sectores = useSectores();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const { id } = useLocalSearchParams<{ id?: string }>();
  const sectorExistente = id ? sectores.find((s) => s.id === id) ?? null : null;
  const editando = sectorExistente !== null;

  const [nombre, setNombre] = useState(sectorExistente?.nombre ?? '');
  const [limiteTexto, setLimiteTexto] = useState(
    sectorExistente?.limiteMensual ? String(sectorExistente.limiteMensual / 100).replace('.', ',') : ''
  );
  const [color, setColor] = useState(sectorExistente?.color ?? sectorPalette[sectores.length % sectorPalette.length]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!nombre.trim()) {
      setError('Ingresá un nombre');
      return;
    }
    const limiteMensual = limiteTexto.trim() ? parseAmountToCentavos(limiteTexto) : null;
    setGuardando(true);
    try {
      if (sectorExistente) {
        await repos.sectors.guardar({ id: sectorExistente.id, nombre: nombre.trim(), color, limiteMensual });
      } else {
        await repos.sectors.guardar({ nombre: nombre.trim(), color, limiteMensual });
      }
      router.back();
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!sectorExistente) return;
    await repos.sectors.eliminar(sectorExistente.id);
    router.back();
  }

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.etiquetaCampo}>Nombre</Text>
      <TextInput value={nombre} onChangeText={setNombre} placeholder="Ej: Ocio" style={estilos.input} autoFocus />

      <Text style={estilos.etiquetaCampo}>Límite mensual (opcional)</Text>
      <TextInput
        value={limiteTexto}
        onChangeText={setLimiteTexto}
        placeholder="Ej: 50000"
        keyboardType="decimal-pad"
        style={estilos.input}
      />

      <Text style={estilos.etiquetaCampo}>Color</Text>
      <View style={estilos.filaColores}>
        {sectorPalette.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[estilos.swatch, { backgroundColor: c }, color === c && estilos.swatchActivo]}
          />
        ))}
      </View>

      <Toast texto={error} tipo="error" colors={colors} />

      <Pressable style={estilos.boton} onPress={guardar} disabled={guardando}>
        <Text style={estilos.textoBoton}>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear sector'}</Text>
      </Pressable>

      {editando && (
        <Pressable style={estilos.botonBorrar} onPress={eliminar}>
          <Text style={estilos.textoBotonBorrar}>Borrar sector</Text>
        </Pressable>
      )}
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
    etiquetaCampo: { color: colors.text2, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface },
    filaColores: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    swatch: { width: 32, height: 32, borderRadius: 16 },
    swatchActivo: { borderWidth: 3, borderColor: colors.text1 },
    boton: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
    textoBoton: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
    botonBorrar: { alignItems: 'center', padding: spacing.md },
    textoBotonBorrar: { color: colors.red, fontWeight: '600' },
  });
}
