import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../theme/theme-context';
import type { Colors } from '../theme/palettes';

export interface BarraDato {
  etiqueta: string;
  valor: number;
  /** true resalta esta barra (ej. el mes actual) con el color primario. */
  destacada?: boolean;
}

interface BarChartProps {
  datos: BarraDato[];
  alturaMax?: number;
}

/** Gráfico de barras simple y liviano (sin librerías), para tendencias mes a mes. */
export function BarChart({ datos, alturaMax = 120 }: BarChartProps) {
  const colors = useColors();
  const estilos = crearEstilos(colors);
  const max = Math.max(1, ...datos.map((d) => d.valor));

  return (
    <View style={estilos.contenedor}>
      {datos.map((d, i) => {
        const alturaBarra = Math.max(3, Math.round((d.valor / max) * alturaMax));
        return (
          <View key={i} style={estilos.columna}>
            <View style={estilos.zonaBarra}>
              <View
                style={[
                  estilos.barra,
                  { height: alturaBarra, backgroundColor: d.destacada ? colors.primary : colors.primaryLight },
                ]}
              />
            </View>
            <Text style={estilos.etiqueta} numberOfLines={1}>
              {d.etiqueta}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    contenedor: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
    columna: { flex: 1, alignItems: 'center' },
    zonaBarra: { height: 120, justifyContent: 'flex-end' },
    barra: { width: '100%', minWidth: 18, borderRadius: 4 },
    etiqueta: { color: colors.text3, fontSize: 11, marginTop: 4 },
  });
}
