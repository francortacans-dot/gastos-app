import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { usePathname } from 'expo-router';

/**
 * Fade + slide sutil (200ms) para el contenido de una pantalla. Los tabs de
 * abajo (Inicio/Historial/Sectores/Ahorro) navegan cambiando de ruta pero el
 * navegador de tabs no anima la transición (ni siquiera remonta la pantalla
 * al volver a una ya visitada), así que se dispara con `usePathname()` como
 * trigger en vez de con el montaje del componente: así corre cada vez que
 * cambia la ruta, se haya remontado la pantalla o no.
 */
export function PantallaAnimada({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const pathname = usePathname();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [pathname, anim]);

  return (
    <Animated.View
      style={[
        { flex: 1 },
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
