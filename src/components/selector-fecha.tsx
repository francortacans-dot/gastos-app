import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColors } from '../theme/theme-context';
import type { Colors } from '../theme/palettes';
import type { MonthKey } from '../domain/types';
import { CalendarMes } from './calendar-mes';
import { IconArrowLeft, IconArrowRight, IconHistorial } from './icons';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function nombreDeMes(mesClave: MonthKey): string {
  const [anio, mesNum] = mesClave.split('-').map(Number);
  const fecha = new Date(anio, mesNum - 1, 1);
  const texto = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function nombreDeDia(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  const texto = fecha.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

interface SelectorFechaProps {
  mes: MonthKey;
  onMesChange: (mes: MonthKey) => void;
  diaSeleccionado: string | null;
  onDiaChange: (fecha: string | null) => void;
  fechasConGasto: Set<string>;
}

/**
 * Selector de fecha compacto: un botón chico que muestra el mes (o día)
 * elegido, y al tocarlo despliega un panel con navegación por año, grilla de
 * meses, y el calendario de días para el mes elegido. Colapsa solo, evita
 * que el calendario ocupe pantalla todo el tiempo.
 */
export function SelectorFecha({ mes, onMesChange, diaSeleccionado, onDiaChange, fechasConGasto }: SelectorFechaProps) {
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<'meses' | 'dias'>('meses');
  const [anioNav, setAnioNav] = useState(() => Number(mes.split('-')[0]));

  function abrir() {
    setAnioNav(Number(mes.split('-')[0]));
    setVista('dias');
    setAbierto(true);
  }

  function elegirMes(mesNum: number) {
    onMesChange(`${anioNav}-${pad(mesNum)}`);
    onDiaChange(null);
    setVista('dias');
  }

  function elegirDia(fecha: string | null) {
    onDiaChange(fecha);
    setAbierto(false);
  }

  return (
    <View>
      <Pressable style={estilos.trigger} onPress={() => (abierto ? setAbierto(false) : abrir())}>
        <IconHistorial color={colors.text2} size={16} />
        <Text style={estilos.textoTrigger}>{diaSeleccionado ? nombreDeDia(diaSeleccionado) : nombreDeMes(mes)}</Text>
        <Text style={estilos.chevron}>{abierto ? '▲' : '▼'}</Text>
      </Pressable>

      {abierto && (
        <View style={estilos.panel}>
          {vista === 'meses' ? (
            <>
              <View style={estilos.filaAnio}>
                <Pressable onPress={() => setAnioNav((a) => a - 1)} hitSlop={8}>
                  <IconArrowLeft color={colors.text2} size={20} />
                </Pressable>
                <Text style={estilos.textoAnio}>{anioNav}</Text>
                <Pressable onPress={() => setAnioNav((a) => a + 1)} hitSlop={8}>
                  <IconArrowRight color={colors.text2} size={20} />
                </Pressable>
              </View>
              <View style={estilos.grillaMeses}>
                {MESES_CORTOS.map((nombreMes, i) => {
                  const clave = `${anioNav}-${pad(i + 1)}`;
                  const activo = clave === mes;
                  return (
                    <Pressable
                      key={nombreMes}
                      onPress={() => elegirMes(i + 1)}
                      style={[estilos.celdaMes, activo && estilos.celdaMesActiva]}
                    >
                      <Text style={[estilos.textoCeldaMes, activo && estilos.textoCeldaMesActiva]}>{nombreMes}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <Pressable onPress={() => setVista('meses')} style={estilos.volverAMeses}>
                <Text style={estilos.textoVolver}>‹ Elegir otro mes</Text>
              </Pressable>
              <CalendarMes mes={mes} fechasConGasto={fechasConGasto} diaSeleccionado={diaSeleccionado} onSeleccionarDia={elegirDia} />
            </>
          )}
        </View>
      )}
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginBottom: 12,
    },
    textoTrigger: { color: colors.text1, fontWeight: '600', fontSize: 14 },
    chevron: { color: colors.text3, fontSize: 10 },
    panel: { backgroundColor: colors.surface, borderRadius: 16, padding: 12, marginBottom: 16 },
    filaAnio: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 10 },
    textoAnio: { color: colors.text1, fontWeight: '700', fontSize: 16, minWidth: 50, textAlign: 'center' },
    grillaMeses: { flexDirection: 'row', flexWrap: 'wrap' },
    celdaMes: { width: '25%', paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    celdaMesActiva: { backgroundColor: colors.primary },
    textoCeldaMes: { color: colors.text2, fontSize: 13, fontWeight: '600' },
    textoCeldaMesActiva: { color: colors.onPrimary },
    volverAMeses: { marginBottom: 8 },
    textoVolver: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  });
}
