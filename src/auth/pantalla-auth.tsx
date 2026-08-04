import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { iniciarSesion, crearCuenta, recuperarContrasena } from './email-auth';
import { palettes } from '../theme/palettes';
import { spacing } from '../theme/spacing';

const colors = palettes.gris;

type Modo = 'login' | 'registro' | 'recuperar';

function mensajeDeError(error: unknown): string {
  const codigo = (error as { code?: string })?.code ?? '';
  switch (codigo) {
    case 'auth/invalid-email':
      return 'Ese email no es válido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email o contraseña incorrectos.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con ese email.';
    case 'auth/weak-password':
      return 'La contraseña tiene que tener al menos 6 caracteres.';
    default:
      return 'Algo salió mal. Probá de nuevo.';
  }
}

export function PantallaAuth() {
  const [modo, setModo] = useState<Modo>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setError(null);
    setMensaje(null);
  }

  async function enviar() {
    setError(null);
    setMensaje(null);

    if (modo === 'recuperar') {
      if (!email.trim()) {
        setError('Ingresá tu email');
        return;
      }
      setEnviando(true);
      try {
        await recuperarContrasena(email.trim());
        setMensaje('Te mandamos un email para recuperar tu contraseña.');
      } catch (e) {
        setError(mensajeDeError(e));
      } finally {
        setEnviando(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError('Completá email y contraseña');
      return;
    }
    if (modo === 'registro' && password !== confirmarPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setEnviando(true);
    try {
      if (modo === 'login') {
        await iniciarSesion(email.trim(), password);
      } else {
        await crearCuenta(email.trim(), password);
      }
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>Gastos</Text>
      <Text style={estilos.subtitulo}>
        {modo === 'login' && 'Ingresá con tu email'}
        {modo === 'registro' && 'Creá tu cuenta'}
        {modo === 'recuperar' && 'Recuperar contraseña'}
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        style={estilos.input}
      />

      {modo !== 'recuperar' && (
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña"
          secureTextEntry
          style={estilos.input}
        />
      )}

      {modo === 'registro' && (
        <TextInput
          value={confirmarPassword}
          onChangeText={setConfirmarPassword}
          placeholder="Repetí la contraseña"
          secureTextEntry
          style={estilos.input}
        />
      )}

      {error && <Text style={estilos.error}>{error}</Text>}
      {mensaje && <Text style={estilos.mensaje}>{mensaje}</Text>}

      <Pressable style={estilos.boton} onPress={enviar} disabled={enviando}>
        <Text style={estilos.textoBoton}>
          {enviando
            ? 'Un momento...'
            : modo === 'login'
              ? 'Entrar'
              : modo === 'registro'
                ? 'Crear cuenta'
                : 'Mandar email'}
        </Text>
      </Pressable>

      <View style={estilos.enlaces}>
        {modo === 'login' && (
          <>
            <Pressable onPress={() => cambiarModo('registro')}>
              <Text style={estilos.enlace}>Crear cuenta</Text>
            </Pressable>
            <Pressable onPress={() => cambiarModo('recuperar')}>
              <Text style={estilos.enlace}>Olvidé mi contraseña</Text>
            </Pressable>
          </>
        )}
        {modo !== 'login' && (
          <Pressable onPress={() => cambiarModo('login')}>
            <Text style={estilos.enlace}>Ya tengo cuenta</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  titulo: { fontSize: 28, fontWeight: '700', color: colors.text1, marginBottom: spacing.xs },
  subtitulo: { fontSize: 15, color: colors.text3, marginBottom: spacing.lg },
  input: {
    width: 280,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  error: { color: colors.red, marginBottom: spacing.sm, textAlign: 'center', width: 280 },
  mensaje: { color: colors.primaryDark, marginBottom: spacing.sm, textAlign: 'center', width: 280 },
  boton: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 8, width: 280, alignItems: 'center' },
  textoBoton: { color: colors.surface, fontWeight: '600' },
  enlaces: { marginTop: spacing.lg, alignItems: 'center', gap: spacing.sm },
  enlace: { color: colors.primary, fontWeight: '600' },
});
