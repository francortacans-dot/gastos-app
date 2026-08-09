import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import type { Colors } from '../theme/palettes';
import { spacing } from '../theme/spacing';

type TipoToast = 'error' | 'exito';

interface ToastProps {
  /** Texto a mostrar. Si es `null`/vacío, el toast no ocupa espacio. */
  texto: string | null;
  tipo?: TipoToast;
  colors: Colors;
}

/**
 * Reemplazo animado del típico `{error && <Text style={estilos.error}>...}`.
 * Entra con un pop sutil (fade + slide + scale) cada vez que `texto` cambia
 * de null a un mensaje, en vez de aparecer de golpe.
 */
export function Toast({ texto, tipo = 'error', colors }: ToastProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (texto) {
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 9,
        tension: 80,
      }).start();
    }
  }, [texto, anim]);

  if (!texto) return null;

  const esError = tipo === 'error';
  const colorFondo = esError ? colors.redLight : colors.primaryLight;
  const colorTexto = esError ? colors.red : colors.primaryDark;

  return (
    <Animated.View
      style={[
        estilos.contenedor,
        {
          backgroundColor: colorFondo,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      <Text style={[estilos.texto, { color: colorTexto }]}>{texto}</Text>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  texto: { textAlign: 'center', fontWeight: '600' },
});
