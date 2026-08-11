import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '../theme/theme-context';
import { IconArrowLeft } from './icons';

/** Flecha de "volver" para usar como headerLeft en pantallas apiladas (no las tabs). */
export function BotonVolver() {
  const router = useRouter();
  const colors = useColors();
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} style={{ paddingRight: 12, paddingVertical: 4 }}>
      <IconArrowLeft color={colors.text1} size={24} />
    </Pressable>
  );
}
