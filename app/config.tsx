import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { signOut } from 'firebase/auth';
import { useApp } from '../src/app-context';
import { useAuth } from '../src/auth/auth-context';
import { crearCuenta } from '../src/auth/email-auth';
import { getFirebaseAuth } from '../src/firebase/app';
import { usePreferences } from '../src/preferences/use-preferences';
import { useMesActual } from '../src/hooks/use-mes-actual';
import { usePresupuestos } from '../src/hooks/use-datos';
import { parseAmountToCentavos, formatCentavos } from '../src/domain/money';
import { useColors } from '../src/theme/theme-context';
import { palettes, temaLabels, temaSwatch, type Colors, type TemaId } from '../src/theme/palettes';
import { spacing } from '../src/theme/spacing';
import type { RateKind } from '../src/domain/types';

export default function Configuracion() {
  const { repos } = useApp();
  const { usuario } = useAuth();
  const preferencias = usePreferences();
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);
  const { mes } = useMesActual();
  const presupuestos = usePresupuestos();

  const presupuestoActual = presupuestos.find((p) => p.mes === mes)?.totalCentavos ?? 0;
  const [presupuestoTexto, setPresupuestoTexto] = useState(
    presupuestoActual > 0 ? String(presupuestoActual / 100).replace('.', ',') : ''
  );
  const [error, setError] = useState<string | null>(null);

  const [emailCuenta, setEmailCuenta] = useState('');
  const [passwordCuenta, setPasswordCuenta] = useState('');
  const [errorCuenta, setErrorCuenta] = useState<string | null>(null);
  const [creandoCuenta, setCreandoCuenta] = useState(false);

  async function guardarPresupuesto() {
    const centavos = parseAmountToCentavos(presupuestoTexto);
    if (centavos === null) {
      setError('Ingresá un monto válido');
      return;
    }
    await repos.budgets.guardar({ mes, totalCentavos: centavos });
    setError(null);
  }

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

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.seccionTitulo}>Presupuesto del mes actual</Text>
      <TextInput
        value={presupuestoTexto}
        onChangeText={(t) => {
          setPresupuestoTexto(t);
          setError(null);
        }}
        keyboardType="decimal-pad"
        style={estilos.input}
        placeholder="Ej: 150000"
      />
      {error && <Text style={estilos.error}>{error}</Text>}
      <Pressable style={estilos.boton} onPress={guardarPresupuesto}>
        <Text style={estilos.textoBoton}>Guardar presupuesto</Text>
      </Pressable>
      {presupuestoActual > 0 && (
        <Text style={estilos.actual}>Actual: {formatCentavos(presupuestoActual)}</Text>
      )}

      <Text style={estilos.seccionTitulo}>Cotización preferida</Text>
      <View style={estilos.filaOpciones}>
        {(['oficial', 'blue'] as RateKind[]).map((c) => (
          <Pressable
            key={c}
            onPress={() => preferencias.setCotizacionPreferida(c)}
            style={[estilos.opcion, preferencias.cotizacionPreferida === c && estilos.opcionActiva]}
          >
            <Text style={[estilos.textoOpcion, preferencias.cotizacionPreferida === c && estilos.textoOpcionActiva]}>
              {c === 'oficial' ? 'Oficial' : 'Blue'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={estilos.seccionTitulo}>Moneda de visualización por defecto</Text>
      <View style={estilos.filaOpciones}>
        {(['ARS', 'USD'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => preferencias.setMonedaVisualizacion(m)}
            style={[estilos.opcion, preferencias.monedaVisualizacion === m && estilos.opcionActiva]}
          >
            <Text style={[estilos.textoOpcion, preferencias.monedaVisualizacion === m && estilos.textoOpcionActiva]}>{m}</Text>
          </Pressable>
        ))}
      </View>

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

      <Text style={estilos.seccionTitulo}>Cuenta</Text>
      {usuario && !usuario.isAnonymous ? (
        <View>
          <Text style={estilos.actual}>Sesión iniciada como {usuario.email}</Text>
          <Pressable style={estilos.boton} onPress={() => signOut(getFirebaseAuth())}>
            <Text style={estilos.textoBoton}>Cerrar sesión</Text>
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
    seccionTitulo: { color: colors.text2, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface, marginBottom: spacing.sm },
    error: { color: colors.red, marginBottom: spacing.sm },
    boton: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
    textoBoton: { color: colors.surface, fontWeight: '700' },
    actual: { color: colors.text3, marginTop: spacing.xs },
    filaOpciones: { flexDirection: 'row', gap: spacing.sm },
    opcion: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
    opcionActiva: { backgroundColor: colors.primary, borderColor: colors.primary },
    textoOpcion: { color: colors.text2, fontWeight: '600' },
    textoOpcionActiva: { color: colors.surface },
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
