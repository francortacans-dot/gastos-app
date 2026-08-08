import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { signOut } from 'firebase/auth';
import { useAuth } from '../src/auth/auth-context';
import { crearCuenta, cambiarContrasena } from '../src/auth/email-auth';
import { getFirebaseAuth } from '../src/firebase/app';
import { usePreferences } from '../src/preferences/use-preferences';
import { usePinGateContext } from '../src/app-context/pin-gate-context';
import { pinEsValido } from '../src/auth/pin';
import { useColors } from '../src/theme/theme-context';
import { palettes, temaLabels, temaSwatch, type Colors, type TemaId } from '../src/theme/palettes';
import { spacing } from '../src/theme/spacing';

export default function Configuracion() {
  const { usuario } = useAuth();
  const preferencias = usePreferences();
  const gate = usePinGateContext();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const [emailCuenta, setEmailCuenta] = useState('');
  const [passwordCuenta, setPasswordCuenta] = useState('');
  const [errorCuenta, setErrorCuenta] = useState<string | null>(null);
  const [creandoCuenta, setCreandoCuenta] = useState(false);

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [errorPassword, setErrorPassword] = useState<string | null>(null);
  const [mensajePassword, setMensajePassword] = useState<string | null>(null);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  const [pinNuevo, setPinNuevo] = useState('');
  const [errorPin, setErrorPin] = useState<string | null>(null);
  const [mensajePin, setMensajePin] = useState<string | null>(null);

  async function crearCuentaConEmail() {
    if (!emailCuenta.trim() || passwordCuenta.length < 6) {
      setErrorCuenta('Ingresá un email y una contraseña de al menos 6 caracteres');
      return;
    }
    setCreandoCuenta(true);
    try {
      await crearCuenta(emailCuenta.trim(), passwordCuenta);
      setErrorCuenta(null);
    } catch {
      setErrorCuenta('No se pudo crear la cuenta. Probá con otro email.');
    } finally {
      setCreandoCuenta(false);
    }
  }

  async function cambiarContrasenaCuenta() {
    if (passwordActual.length < 6 || passwordNueva.length < 6) {
      setErrorPassword('Completá ambas contraseñas (mínimo 6 caracteres)');
      return;
    }
    setCambiandoPassword(true);
    try {
      await cambiarContrasena(passwordActual, passwordNueva);
      setErrorPassword(null);
      setMensajePassword('Contraseña actualizada.');
      setPasswordActual('');
      setPasswordNueva('');
    } catch {
      setErrorPassword('No se pudo cambiar la contraseña. Revisá la actual.');
    } finally {
      setCambiandoPassword(false);
    }
  }

  async function guardarPinNuevo() {
    if (!pinEsValido(pinNuevo)) {
      setErrorPin('El PIN tiene que ser de 4 dígitos');
      return;
    }
    await gate.guardarPin(pinNuevo);
    setErrorPin(null);
    setMensajePin('PIN actualizado.');
    setPinNuevo('');
  }

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.seccionTitulo}>Tema</Text>
      <View style={estilos.filaTemas}>
        {(Object.keys(temaLabels) as TemaId[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => preferencias.setTema(t)}
            style={[estilos.tarjetaTema, preferencias.tema === t && estilos.tarjetaTemaActiva]}
          >
            <View style={estilos.filaSwatches}>
              <View style={[estilos.swatch, { backgroundColor: temaSwatch[t] }]} />
              <View style={[estilos.swatch, { backgroundColor: palettes[t].bg, borderWidth: 1, borderColor: colors.border }]} />
              <View style={[estilos.swatch, { backgroundColor: palettes[t].surface2 }]} />
            </View>
            <Text style={estilos.textoTema}>{temaLabels[t]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={estilos.seccionTitulo}>Cambiar PIN</Text>
      <TextInput
        value={pinNuevo}
        onChangeText={(t) => {
          setPinNuevo(t.replace(/\D/g, '').slice(0, 4));
          setMensajePin(null);
        }}
        placeholder="Nuevo PIN de 4 dígitos"
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        style={estilos.input}
      />
      {errorPin && <Text style={estilos.error}>{errorPin}</Text>}
      {mensajePin && <Text style={estilos.mensaje}>{mensajePin}</Text>}
      <Pressable style={estilos.boton} onPress={guardarPinNuevo}>
        <Text style={estilos.textoBoton}>Guardar PIN</Text>
      </Pressable>

      <Text style={estilos.seccionTitulo}>Cuenta</Text>
      {usuario && !usuario.isAnonymous ? (
        <View>
          <Text style={estilos.actual}>Sesión iniciada como {usuario.email}</Text>

          <Text style={estilos.subtitulo}>Cambiar contraseña</Text>
          <TextInput
            value={passwordActual}
            onChangeText={setPasswordActual}
            placeholder="Contraseña actual"
            secureTextEntry
            style={estilos.input}
          />
          <TextInput
            value={passwordNueva}
            onChangeText={setPasswordNueva}
            placeholder="Contraseña nueva"
            secureTextEntry
            style={estilos.input}
          />
          {errorPassword && <Text style={estilos.error}>{errorPassword}</Text>}
          {mensajePassword && <Text style={estilos.mensaje}>{mensajePassword}</Text>}
          <Pressable style={estilos.boton} onPress={cambiarContrasenaCuenta} disabled={cambiandoPassword}>
            <Text style={estilos.textoBoton}>{cambiandoPassword ? 'Guardando...' : 'Cambiar contraseña'}</Text>
          </Pressable>

          <Pressable style={estilos.botonSecundario} onPress={() => signOut(getFirebaseAuth())}>
            <Text style={estilos.textoBotonSecundario}>Cerrar sesión</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Text style={estilos.actual}>
            Todavía no tenés cuenta con email. Creá una para poder entrar con los mismos datos desde otro dispositivo.
          </Text>
          <TextInput
            value={emailCuenta}
            onChangeText={setEmailCuenta}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            style={estilos.input}
          />
          <TextInput
            value={passwordCuenta}
            onChangeText={setPasswordCuenta}
            placeholder="Contraseña"
            secureTextEntry
            style={estilos.input}
          />
          {errorCuenta && <Text style={estilos.error}>{errorCuenta}</Text>}
          <Pressable style={estilos.boton} onPress={crearCuentaConEmail} disabled={creandoCuenta}>
            <Text style={estilos.textoBoton}>{creandoCuenta ? 'Creando...' : 'Crear cuenta con email'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
    seccionTitulo: { color: colors.text2, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm, fontSize: 16 },
    subtitulo: { color: colors.text3, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs, fontSize: 13 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface, marginBottom: spacing.sm },
    error: { color: colors.red, marginBottom: spacing.sm },
    mensaje: { color: colors.primaryDark, marginBottom: spacing.sm },
    boton: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
    textoBoton: { color: colors.onPrimary, fontWeight: '700' },
    botonSecundario: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
    textoBotonSecundario: { color: colors.text2, fontWeight: '600' },
    actual: { color: colors.text3, marginTop: spacing.xs, marginBottom: spacing.sm },
    filaTemas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tarjetaTema: {
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 10,
      padding: spacing.sm,
      width: 100,
    },
    tarjetaTemaActiva: { borderColor: colors.primary },
    filaSwatches: { flexDirection: 'row', gap: 4, marginBottom: spacing.xs },
    swatch: { width: 18, height: 18, borderRadius: 4 },
    textoTema: { color: colors.text2, fontSize: 12, fontWeight: '600' },
  });
}
