import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { usePinGateContext } from '../src/app-context/pin-gate-context';
import { pinEsValido } from '../src/auth/pin';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

export default function PantallaPin() {
  const gate = usePinGateContext();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pinExistente = gate.pinGuardado;

  async function confirmar() {
    if (!pinEsValido(pin)) {
      setError('El PIN tiene que ser de 4 dígitos');
      return;
    }
    if (pinExistente) {
      const ok = await gate.intentarDesbloquear(pin);
      setError(ok ? null : 'PIN incorrecto');
    } else {
      await gate.guardarPin(pin);
    }
    setPin('');
  }

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>{pinExistente ? 'Ingresá tu PIN' : 'Creá un PIN de 4 dígitos'}</Text>
      <TextInput
        value={pin}
        onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        style={estilos.input}
        autoFocus
      />
      {error && <Text style={estilos.error}>{error}</Text>}
      <Pressable style={estilos.boton} onPress={confirmar}>
        <Text style={estilos.textoBoton}>{pinExistente ? 'Entrar' : 'Guardar PIN'}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  titulo: { fontSize: 20, fontWeight: '700', color: colors.text1, marginBottom: spacing.lg },
  input: {
    fontSize: 32,
    letterSpacing: 16,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    width: 160,
    marginBottom: spacing.md,
  },
  error: { color: colors.red, marginBottom: spacing.md },
  boton: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 8 },
  textoBoton: { color: colors.surface, fontWeight: '600' },
});
