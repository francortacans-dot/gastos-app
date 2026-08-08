import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColors } from '../theme/theme-context';
import type { Colors } from '../theme/palettes';
import type { MonthKey } from '../domain/types';

const NOMBRES_DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface CalendarMesProps {
  mes: MonthKey;
  /** Fechas ISO 'YYYY-MM-DD' que tienen al menos un gasto cargado. */
  fechasConGasto: Set<string>;
  diaSeleccionado: string | null;
  onSeleccionarDia: (fecha: string | null) => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Calendario mensual simple: grilla de días con un punto si ese día tiene gastos. Tocar un día lo filtra. */
export function CalendarMes({ mes, fechasConGasto, diaSeleccionado, onSeleccionarDia }: CalendarMesProps) {
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const [anio, mesNum] = mes.split('-').map(Number);
  const diasEnMes = new Date(anio, mesNum, 0).getDate();
  const primerDiaSemana = (new Date(anio, mesNum - 1, 1).getDay() + 6) % 7; // 0 = lunes

  const hoy = new Date();
  const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mesNum;
  const diaDeHoy = hoy.getDate();

  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.filaEncabezado}>
        {NOMBRES_DIAS.map((d, i) => (
          <Text key={i} style={estilos.textoEncabezado}>
            {d}
          </Text>
        ))}
      </View>
      <View style={estilos.grilla}>
        {celdas.map((dia, i) => {
          if (dia === null) return <View key={i} style={estilos.celda} />;
          const fecha = `${anio}-${pad(mesNum)}-${pad(dia)}`;
          const tieneGasto = fechasConGasto.has(fecha);
          const seleccionado = diaSeleccionado === fecha;
          const esHoy = esMesActual && dia === diaDeHoy;
          return (
            <Pressable
              key={i}
              style={estilos.celda}
              onPress={() => onSeleccionarDia(seleccionado ? null : fecha)}
            >
              <View style={[estilos.circuloDia, seleccionado && estilos.circuloSeleccionado, !seleccionado && esHoy && estilos.circuloHoy]}>
                <Text style={[estilos.textoDia, seleccionado && estilos.textoDiaSeleccionado]}>{dia}</Text>
              </View>
              <View style={[estilos.punto, tieneGasto && estilos.puntoActivo]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    contenedor: { backgroundColor: colors.surface, borderRadius: 16, padding: 12, marginBottom: 16 },
    filaEncabezado: { flexDirection: 'row' },
    textoEncabezado: { width: `${100 / 7}%`, textAlign: 'center', color: colors.text3, fontSize: 12, fontWeight: '600', marginBottom: 4 },
    grilla: { flexDirection: 'row', flexWrap: 'wrap' },
    celda: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
    circuloDia: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    circuloHoy: { borderWidth: 1.5, borderColor: colors.primary },
    circuloSeleccionado: { backgroundColor: colors.primary },
    textoDia: { color: colors.text1, fontSize: 13 },
    textoDiaSeleccionado: { color: colors.onPrimary, fontWeight: '700' },
    punto: { width: 4, height: 4, borderRadius: 2, marginTop: 2, backgroundColor: 'transparent' },
    puntoActivo: { backgroundColor: colors.primary },
  });
}
