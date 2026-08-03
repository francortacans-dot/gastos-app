import React from 'react';
import { Text, type TextStyle } from 'react-native';
import { formatCentavos, formatUsd, centavosArsToUsd } from '../domain/money';
import { colors } from '../theme/colors';

interface MoneyTextProps {
  centavos: number;
  moneda: 'ARS' | 'USD';
  /** Cotización de venta a usar si moneda es 'USD'. Requerida en ese caso. */
  cotizacion?: number;
  style?: TextStyle;
}

/** Muestra un monto en centavos de ARS, opcionalmente convertido a USD para visualización. */
export function MoneyText({ centavos, moneda, cotizacion, style }: MoneyTextProps) {
  const texto =
    moneda === 'ARS' ? formatCentavos(centavos) : formatUsd(centavosArsToUsd(centavos, cotizacion ?? 0));

  return <Text style={[{ color: colors.text1, fontVariant: ['tabular-nums'] }, style]}>{texto}</Text>;
}
