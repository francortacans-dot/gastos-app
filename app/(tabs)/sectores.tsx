import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/app-context';
import { useSectores } from '../../src/hooks/use-datos';
import { sectorPalette } from '../../src/theme/colors';
import { SECTORES_SUGERIDOS } from '../../src/domain/sectores-sugeridos';
import { formatCentavos } from '../../src/domain/money';
import { IconPlus, IconPencil } from '../../src/components/icons';
import { useColors } from '../../src/theme/theme-context';
import type { Colors } from '../../src/theme/palettes';
import { spacing } from '../../src/theme/spacing';
import type { Sector } from '../../src/domain/types';

export default function Sectores() {
  const router = useRouter();
  const { repos } = useApp();
  const sectores = useSectores();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const nombresExistentes = new Set(sectores.map((s) => s.nombre.trim().toLowerCase()));
  const sugeridos = SECTORES_SUGERIDOS.filter((n) => !nombresExistentes.has(n.toLowerCase()));

  async function agregarSugerido(nombre: string) {
    const color = sectorPalette[sectores.length % sectorPalette.length];
    await repos.sectors.guardar({ nombre, color, limiteMensual: null });
  }

  function renderSector(item: Sector) {
    return (
      <Pressable key={item.id} style={estilos.fila} onPress={() => router.push(`/sector-nuevo?id=${item.id}`)}>
        <View style={[estilos.punto, { backgroundColor: item.color }]} />
        <View style={estilos.info}>
          <Text style={estilos.nombreSector}>{item.nombre}</Text>
          <Text style={estilos.limiteSector}>
            {item.limiteMensual !== null ? `Límite: ${formatCentavos(item.limiteMensual)}` : 'Sin límite'}
          </Text>
        </View>
        <IconPencil color={colors.text3} size={16} />
      </Pressable>
    );
  }

  return (
    <View style={estilos.contenedor}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        {sectores.length === 0 ? (
          <Text style={estilos.vacio}>Todavía no cargaste sectores. Agregá uno de los sugeridos o creá el tuyo con el botón +.</Text>
        ) : (
          <View style={estilos.lista}>{sectores.map(renderSector)}</View>
        )}

        {sugeridos.length > 0 && (
          <View style={estilos.bloqueSugeridos}>
            <Text style={estilos.tituloSugeridos}>Sugeridos</Text>
            <View style={estilos.filaChips}>
              {sugeridos.map((nombre) => (
                <Pressable key={nombre} style={estilos.chipSugerido} onPress={() => agregarSugerido(nombre)}>
                  <Text style={estilos.textoChipSugerido}>+ {nombre}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <Pressable style={estilos.botonFlotante} onPress={() => router.push('/sector-nuevo')}>
        <IconPlus color={colors.onPrimary} size={26} />
      </Pressable>
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg },
    contenido: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
    vacio: { color: colors.text3, textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
    lista: { marginBottom: spacing.md },
    fila: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.xs },
    punto: { width: 14, height: 14, borderRadius: 7, marginRight: spacing.sm },
    info: { flex: 1 },
    nombreSector: { color: colors.text1, fontWeight: '600' },
    limiteSector: { color: colors.text3, fontSize: 12 },
    bloqueSugeridos: { marginTop: spacing.sm },
    tituloSugeridos: { color: colors.text3, fontWeight: '600', fontSize: 13, marginBottom: spacing.xs },
    filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chipSugerido: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    textoChipSugerido: { color: colors.text2, fontSize: 13 },
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
