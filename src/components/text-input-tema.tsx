import React, { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { useColors } from '../theme/theme-context';

/**
 * TextInput que aplica automáticamente un placeholderTextColor grisáceo del
 * tema activo. Usar este componente en vez de importar TextInput directo de
 * react-native, para que los placeholders no se confundan con texto ya escrito.
 */
export const TextInputTema = forwardRef<TextInput, TextInputProps>(function TextInputTema(props, ref) {
  const colors = useColors();
  return <TextInput ref={ref} placeholderTextColor={colors.text4} {...props} />;
});
