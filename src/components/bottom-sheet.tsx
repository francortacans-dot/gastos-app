import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/theme-context';
import { useEsEscritorio } from '../hooks/use-es-escritorio';
import type { Colors } from '../theme/palettes';
import { spacing } from '../theme/spacing';
import { IconClose } from './icons';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface BottomSheetProps {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}

/**
 * Envoltorio para las pantallas de alta/edición (nuevo gasto, sector,
 * objetivo de ahorro). En mobile sube como una hoja con esquinas
 * redondeadas y agarradera; en pantallas anchas se centra como un panel.
 * Reemplaza el modal nativo del Stack (que no seguía la paleta del tema).
 *
 * La pantalla que lo usa debe tener `headerShown: false` y `animation: 'none'`
 * en `_layout.tsx`: la animación de entrada/salida la maneja este componente,
 * no el navegador.
 */
export function BottomSheet({ titulo, onCerrar, children }: BottomSheetProps) {
  const colors = useColors();
  const esEscritorio = useEsEscritorio();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);
  const anim = useRef(new Animated.Value(0)).current;
  const cerrando = useRef(false);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  function cerrar() {
    if (cerrando.current) return;
    cerrando.current = true;
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onCerrar();
    });
  }

  const transformPanel = esEscritorio
    ? [
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
      ]
    : [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [640, 0] }) }];

  return (
    <View style={estilos.raiz}>
      <AnimatedPressable style={[StyleSheet.absoluteFill, estilos.scrim, { opacity: anim }]} onPress={cerrar} />
      <KeyboardAvoidingView
        pointerEvents="box-none"
        style={[estilos.centrador, esEscritorio ? estilos.centradorEscritorio : estilos.centradorMobile]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          style={[
            estilos.panel,
            esEscritorio ? estilos.panelEscritorio : estilos.panelMobile,
            { opacity: anim, transform: transformPanel },
          ]}
        >
          {!esEscritorio && <View style={estilos.agarradera} />}
          <View style={estilos.encabezado}>
            <Text style={estilos.titulo}>{titulo}</Text>
            <Pressable onPress={cerrar} hitSlop={10} style={estilos.botonCerrar}>
              <IconClose color={colors.text2} size={16} />
            </Pressable>
          </View>
          <ScrollView
            style={estilos.cuerpo}
            contentContainerStyle={estilos.cuerpoContenido}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    raiz: { flex: 1, backgroundColor: colors.bg },
    scrim: { backgroundColor: 'rgba(0,0,0,0.4)' },
    centrador: { flex: 1 },
    centradorMobile: { justifyContent: 'flex-end' },
    centradorEscritorio: { justifyContent: 'center', alignItems: 'center' },
    panel: {
      backgroundColor: colors.surface,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 4 },
      elevation: 12,
    },
    panelMobile: { maxHeight: '88%', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
    panelEscritorio: { width: 440, maxWidth: '90%', maxHeight: '82%', borderRadius: 20 },
    agarradera: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: spacing.sm },
    encabezado: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    titulo: { fontSize: 17, fontWeight: '700', color: colors.text1 },
    botonCerrar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
    cuerpo: { flex: 1 },
    cuerpoContenido: { padding: spacing.lg, paddingBottom: spacing.xl },
  });
}
