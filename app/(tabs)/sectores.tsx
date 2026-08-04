import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useApp } from '../../src/app-context';
import { useSectores } from '../../src/hooks/use-datos';
import { sectorPalette } from '../../src/theme/colors';
import { parseAmountToCentavos, formatCentavos } from '../../src/domain/money';
import { useColors } from '../../src/theme/theme-context';
import type { Colors } from '../../src/theme/palettes';
import { spacing } from '../../src/theme/spacing';
import type { Sector } from '../../src/domain/types';

export default function Sectores() {
  const { repos } = useApp();
  const sectores = useSectores();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const [nombre, setNombre] = useState('');
  const [limiteTexto, setLimiteTexto] = useState('');

  async function agregarSector() {
    if (!nombre.trim()) return;
    const color = sectorPalette[sectores.length % sectorPalette.length];
    const limiteMensual = limiteTexto.trim() ? parseAmountToCentavos(limiteTexto) : null;
    await repos.sectors.guardar({ nombre: nombre.trim(), color, limiteMensual });
    setNombre('');
    setLimiteTexto('');
  }

  async function eliminarSector(id: string) {
    await repos.sectors.eliminar(id);
  }

  function renderSector({ item }: { item: Sector }) {
    return (
      <View style={estilos.fila}>
        <View style={[estilos.punto, { backgroundColor: item.color }]} />
        <View style={estilos.info}>
          <Text style={estilos.nombreSector}>{item.nombre}</Text>
          <Text style={estilos.limiteSector}>
            {item.limiteMensual !== null ? `Límite: ${formatCentavos(item.limiteMensual)}` : 'Sin límite'}
          </Text>
        </View>
        <Pressable onPress={() => eliminarSector(item.id)}>
          <Text style={estilos.eliminar}>Borrar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={estilos.contenedor}>
      <FlatList
        data={sectores}
        keyExtractor={(s) => s.id}
        renderItem={renderSector}
        contentContainerStyle={estilos.lista}
        ListEmptyComponent={<Text style={estilos.vacio}>Todavía no cargaste sectores.</Text>}
      />

      <View style={estilos.formulario}>
        <TextInput value={nombre} onChangeText={setNombre} placeholder="Nombre (ej: Ocio)" style={estilos.input} />
        <TextInput
          value={limiteTexto}
          onChangeText={setLimiteTexto}
          placeholder="Límite mensual (opcional)"
          keyboardType="decimal-pad"
          style={estilos.input}
        />
        <Pressable style={estilos.boton} onPress={agregarSector}>
          <Text style={estilos.textoBoton}>Agregar sector</Text>
        </Pressable>
      </View>
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg },
    lista: { padding: spacing.md },
    vacio: { color: colors.text3, textAlign: 'center', marginTop: spacing.lg },
    fila: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.xs },
    punto: { width: 14, height: 14, borderRadius: 7, marginRight: spacing.sm },
    info: { flex: 1 },
    nombreSector: { color: colors.text1, fontWeight: '600' },
    limiteSector: { color: colors.text3, fontSize: 12 },
    eliminar: { color: colors.red },
    formulario: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm },
    boton: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
    textoBoton: { color: colors.surface, fontWeight: '700' },
  });
}
