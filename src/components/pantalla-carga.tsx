import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { Colors } from '../theme/palettes';
import { spacing } from '../theme/spacing';

/**
 * Reemplaza el `return null` que se mostraba mientras Firebase Auth resolvía
 * la sesión o el candado de PIN cargaba su estado guardado. Antes eso dejaba
 * la pantalla en blanco un instante; esto da contexto visual (marca + barras
 * pulsantes) mientras tanto, para que la carga inicial se sienta intencional
 * y no como un flash.
 */
export function PantallaCarga({ colors }: { colors: Colors }) {
  const pulso = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animacion = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    animacion.start();
    return () => animacion.stop();
  }, [pulso]);

  const estilos = crearEstilos(colors);

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.marca}>Mis gastos</Text>
      <View style={estilos.barras}>
        <Animated.View style={[estilos.barra, estilos.barraAncha, { opacity: pulso }]} />
        <Animated.View style={[estilos.barra, estilos.barraMedia, { opacity: pulso }]} />
        <Animated.View style={[estilos.barra, estilos.barraAngosta, { opacity: pulso }]} />
      </View>
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    marca: { fontSize: 22, fontWeight: '700', color: colors.text3, marginBottom: spacing.xl },
    barras: { width: '100%', maxWidth: 280, gap: spacing.sm },
    barra: { height: 14, borderRadius: 7, backgroundColor: colors.surface2 },
    barraAncha: { width: '100%' },
    barraMedia: { width: '75%' },
    barraAngosta: { width: '55%' },
  });
}
