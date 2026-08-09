import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { iniciarSesion, crearCuenta, recuperarContrasena } from './email-auth';
import { IconMail, IconLock } from '../components/icons';
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
    <View style={estilos.fondo}>
      <View style={estilos.marca}>
        <Text style={estilos.tituloMarca}>Mis gastos</Text>
        <Text style={estilos.tagline}>Controlá tu plata, fácil y rápido</Text>
      </View>

      <View style={estilos.tarjeta}>
        <Text style={estilos.subtitulo}>
          {modo === 'login' && 'Ingresá con tu email'}
          {modo === 'registro' && 'Creá tu cuenta'}
          {modo === 'recuperar' && 'Recuperar contraseña'}
        </Text>

        <View style={estilos.campo}>
          <IconMail color={colors.text3} size={18} />
          <TextInput
            placeholderTextColor={colors.text4}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            style={estilos.input}
          />
        </View>

        {modo !== 'recuperar' && (
          <View style={estilos.campo}>
            <IconLock color={colors.text3} size={18} />
            <TextInput
            placeholderTextColor={colors.text4}
              value={password}
              onChangeText={setPassword}
              placeholder="Contraseña"
              secureTextEntry
              style={estilos.input}
            />
          </View>
        )}

        {modo === 'registro' && (
          <View style={estilos.campo}>
            <IconLock color={colors.text3} size={18} />
            <TextInput
            placeholderTextColor={colors.text4}
              value={confirmarPassword}
              onChangeText={setConfirmarPassword}
              placeholder="Repetí la contraseña"
              secureTextEntry
              style={estilos.input}
            />
          </View>
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
    </View>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  marca: { alignItems: 'center', marginBottom: spacing.xl },
  tituloMarca: { fontSize: 34, fontWeight: '700', color: colors.onPrimary },
  tagline: { fontSize: 14, color: colors.primaryLight, marginTop: spacing.xs },
  tarjeta: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
  },
  subtitulo: { fontSize: 16, fontWeight: '600', color: colors.text1, marginBottom: spacing.md, textAlign: 'center' },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface2,
  },
  input: { flex: 1, padding: spacing.sm },
  error: { color: colors.red, marginBottom: spacing.sm, textAlign: 'center' },
  mensaje: { color: colors.primaryDark, marginBottom: spacing.sm, textAlign: 'center' },
  boton: { backgroundColor: colors.primary, paddingVertical: spacing.sm, borderRadius: 10, alignItems: 'center', marginTop: spacing.xs },
  textoBoton: { color: colors.onPrimary, fontWeight: '600' },
  enlaces: { marginTop: spacing.lg, alignItems: 'center', gap: spacing.sm },
  enlace: { color: colors.primary, fontWeight: '600' },
});
