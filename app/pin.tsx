import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { usePinGateContext } from '../src/app-context/pin-gate-context';
import { useAuth } from '../src/auth/auth-context';
import { reautenticar } from '../src/auth/email-auth';
import { pinEsValido } from '../src/auth/pin';
import { useColors } from '../src/theme/theme-context';
import type { Colors } from '../src/theme/palettes';
import { spacing } from '../src/theme/spacing';

export default function PantallaPin() {
  const gate = usePinGateContext();
  const { usuario } = useAuth();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [recuperando, setRecuperando] = useState(false);
  const [password, setPassword] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [errorRecuperar, setErrorRecuperar] = useState<string | null>(null);

  const pinExistente = gate.pinGuardado;
  const puedeRecuperar = usuario && !usuario.isAnonymous;

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

  async function confirmarRecuperacion() {
    if (!password) {
      setErrorRecuperar('Ingresá tu contraseña');
      return;
    }
    if (!pinEsValido(pinNuevo)) {
      setErrorRecuperar('El PIN nuevo tiene que ser de 4 dígitos');
      return;
    }
    try {
      await reautenticar(password);
      await gate.guardarPin(pinNuevo);
      setRecuperando(false);
      setPassword('');
      setPinNuevo('');
      setErrorRecuperar(null);
    } catch {
      setErrorRecuperar('Contraseña incorrecta');
    }
  }

  if (recuperando) {
    return (
      <View style={estilos.contenedor}>
        <Text style={estilos.titulo}>Restablecer PIN</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña de tu cuenta"
          secureTextEntry
          style={estilos.inputAncho}
          autoFocus
        />
        <TextInput
          value={pinNuevo}
          onChangeText={(t) => setPinNuevo(t.replace(/\D/g, '').slice(0, 4))}
          placeholder="PIN nuevo de 4 dígitos"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          style={estilos.inputAncho}
        />
        {errorRecuperar && <Text style={estilos.error}>{errorRecuperar}</Text>}
        <Pressable style={estilos.boton} onPress={confirmarRecuperacion}>
          <Text style={estilos.textoBoton}>Guardar PIN nuevo</Text>
        </Pressable>
        <Pressable onPress={() => setRecuperando(false)} style={estilos.enlaceContenedor}>
          <Text style={estilos.enlace}>Volver</Text>
        </Pressable>
      </View>
    );
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
      {pinExistente && puedeRecuperar && (
        <Pressable onPress={() => setRecuperando(true)} style={estilos.enlaceContenedor}>
          <Text style={estilos.enlace}>Olvidé mi PIN</Text>
        </Pressable>
      )}
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
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
    inputAncho: {
      width: 280,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: spacing.sm,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
    },
    error: { color: colors.red, marginBottom: spacing.md },
    boton: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 8 },
    textoBoton: { color: colors.surface, fontWeight: '600' },
    enlaceContenedor: { marginTop: spacing.md },
    enlace: { color: colors.primary, fontWeight: '600' },
  });
}
