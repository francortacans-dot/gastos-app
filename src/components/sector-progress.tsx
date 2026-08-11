import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCentavos } from '../domain/money';
import { useColors } from '../theme/theme-context';
import type { Colors } from '../theme/palettes';
import { spacing } from '../theme/spacing';

interface SectorProgressProps {
  nombre: string;
  color: string;
  gastado: number;
  /** Límite mensual en centavos. null = sector sin tope, se muestra solo el gasto. */
  limite: number | null;
}

export function SectorProgress({ nombre, color, gastado, limite }: SectorProgressProps) {
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);
  const porcentaje = limite && limite > 0 ? Math.min(100, (gastado / limite) * 100) : 0;
  const sobrepasado = limite !== null && gastado > limite;

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.filaTitulo}>
        <View style={[estilos.punto, { backgroundColor: color }]} />
        <Text style={estilos.nombre}>{nombre}</Text>
        <Text style={estilos.monto}>
          {formatCentavos(gastado)}
          {limite !== null ? ` / ${formatCentavos(limite)}` : ''}
        </Text>
      </View>
      {limite !== null && (
        <View style={estilos.barraFondo}>
          <View
            style={[
              estilos.barraRelleno,
              { width: `${porcentaje}%`, backgroundColor: sobrepasado ? colors.red : color },
            ]}
          />
        </View>
      )}
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    contenedor: { marginBottom: spacing.md },
    filaTitulo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
    punto: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.xs },
    nombre: { flex: 1, color: colors.text1, fontWeight: '600' },
    monto: { color: colors.text3, fontSize: 13 },
    barraFondo: { height: 6, borderRadius: 3, backgroundColor: colors.surface2, overflow: 'hidden' },
    barraRelleno: { height: '100%', borderRadius: 3 },
  });
}
