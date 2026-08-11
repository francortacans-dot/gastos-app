import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { calcularAngulos, type Porcion } from './pie-chart-math';
import { useColors } from '../theme/theme-context';

function puntoEnCirculo(cx: number, cy: number, radio: number, anguloGrados: number) {
  const anguloRad = ((anguloGrados - 90) * Math.PI) / 180;
  return { x: cx + radio * Math.cos(anguloRad), y: cy + radio * Math.sin(anguloRad) };
}

function pathDePorcion(cx: number, cy: number, radio: number, inicio: number, fin: number): string {
  const p1 = puntoEnCirculo(cx, cy, radio, inicio);
  const p2 = puntoEnCirculo(cx, cy, radio, fin);
  const arcoGrande = fin - inicio > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${radio} ${radio} 0 ${arcoGrande} 1 ${p2.x} ${p2.y} Z`;
}

export function PieChart({ porciones, size = 200 }: { porciones: Porcion[]; size?: number }) {
  const colors = useColors();
  const radio = size / 2;
  const conAngulos = calcularAngulos(porciones);

  if (conAngulos.length === 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle cx={radio} cy={radio} r={radio - 2} fill={colors.surface2} stroke={colors.border} strokeWidth={2} />
        </Svg>
      </View>
    );
  }

  return (
    <Svg width={size} height={size}>
      {conAngulos.map((p) => (
        <Path key={p.etiqueta} d={pathDePorcion(radio, radio, radio - 2, p.anguloInicio, p.anguloFin)} fill={p.color} />
      ))}
    </Svg>
  );
}
