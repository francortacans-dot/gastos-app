import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, FlatList, StyleSheet } from 'react-native';
import { TextInputTema as TextInput } from '../../src/components/text-input-tema';
import { Toast } from '../../src/components/toast';
import { useRouter } from 'expo-router';
import { PantallaAnimada } from '../../src/components/pantalla-animada';
import { useApp } from '../../src/app-context';
import { useAhorros, useObjetivos, useInversiones, useBrokerCash } from '../../src/hooks/use-datos';
import { useMesActual } from '../../src/hooks/use-mes-actual';
import { useResumenMes } from '../../src/hooks/use-resumen-mes';
import { ahorradoHasta, mesAnterior } from '../../src/domain/budget';
import { parseAmountToCentavos, formatCentavos } from '../../src/domain/money';
import { patrimonioInversiones } from '../../src/domain/investments';
import { porcentajeObjetivo } from '../../src/domain/objetivos';
import { IconPlus } from '../../src/components/icons';
import { useColors } from '../../src/theme/theme-context';
import type { Colors } from '../../src/theme/palettes';
import { spacing } from '../../src/theme/spacing';

export default function Ahorro() {
  const router = useRouter();
  const { repos } = useApp();
  const movimientos = useAhorros();
  const objetivos = useObjetivos();
  const { mes } = useMesActual();
  const resumen = useResumenMes(mes);
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);

  const [montoTexto, setMontoTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [origen, setOrigen] = useState<'ingresos' | 'externo'>('ingresos');

  const totalAhorrado = movimientos.reduce((acc, m) => acc + m.centavosArs, 0);
  const inversiones = useInversiones();
  const brokerCash = useBrokerCash();
  const patrimonioTotal = totalAhorrado + patrimonioInversiones(inversiones, brokerCash.centavosArs);
  const movimientosOrdenados = [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Lo que ya se mandó a ahorro ESTE mes desde el presupuesto (origen 'ingresos'),
  // para no dejar mandar dos veces el mismo disponible dentro del mismo mes.
  const enviadoEsteMesDesdePresupuesto =
    ahorradoHasta(movimientos, mes, 'ingresos') - ahorradoHasta(movimientos, mesAnterior(mes), 'ingresos');
  const disponibleParaAhorro = resumen.disponible - enviadoEsteMesDesdePresupuesto;

  async function mandarAAhorro() {
    if (enviando) return;
    const centavos = parseAmountToCentavos(montoTexto);
    if (centavos === null || centavos <= 0) {
      setError('Ingresá un monto válido');
      return;
    }
    if (origen === 'ingresos' && centavos > disponibleParaAhorro) {
      setError(`No podés mandar más de ${formatCentavos(disponibleParaAhorro)} (tu disponible de este mes)`);
      return;
    }
    setEnviando(true);
    try {
      await repos.savings.agregar({
        centavosArs: centavos,
        fecha: new Date().toISOString().slice(0, 10),
        nota: null,
        origen,
      });
      setMontoTexto('');
      setError(null);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PantallaAnimada style={estilos.contenedor}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.tarjetaTotal}>
          <Text style={estilos.etiqueta}>Total ahorrado</Text>
          <Text style={estilos.montoGrande}>{formatCentavos(totalAhorrado)}</Text>
          <Text style={estilos.etiqueta}>Disponible para mandar a ahorro: {formatCentavos(disponibleParaAhorro)}</Text>
          <Text style={estilos.etiqueta}>Patrimonio total (ahorro + inversiones)</Text>
          <Text style={estilos.montoGrande}>{formatCentavos(patrimonioTotal)}</Text>
        </View>

        <Text style={estilos.tituloSeccion}>Objetivos</Text>
        {objetivos.length === 0 ? (
          <Pressable onPress={() => router.push('/objetivo-nuevo')}>
            <Text style={estilos.vacio}>Todavía no tenés objetivos. Tocá acá o el botón + para crear el primero.</Text>
          </Pressable>
        ) : (
          <View style={estilos.listaObjetivos}>
            {objetivos.map((o) => {
              const porcentaje = porcentajeObjetivo(o);
              return (
                <Pressable key={o.id} style={estilos.tarjetaObjetivo} onPress={() => router.push(`/objetivo-nuevo?id=${o.id}`)}>
                  <View style={estilos.filaObjetivo}>
                    <Text style={estilos.nombreObjetivo}>{o.nombre}</Text>
                    <Text style={estilos.tamanoObjetivo}>{o.tamano}</Text>
                  </View>
                  <View style={estilos.barraFondo}>
                    <View style={[estilos.barraRelleno, { width: `${porcentaje}%` }]} />
                  </View>
                  <View style={estilos.filaObjetivo}>
                    <Text style={estilos.montoObjetivo}>
                      {formatCentavos(o.montoActualCentavos)} de {formatCentavos(o.montoMetaCentavos)}
                    </Text>
                    <Text style={estilos.porcentajeObjetivo}>{porcentaje}%</Text>
                  </View>
                  {o.fechaObjetivo && <Text style={estilos.fechaObjetivo}>Meta: {o.fechaObjetivo}</Text>}
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={estilos.tituloSeccion}>Mandar a ahorro general</Text>
        <View style={estilos.formulario}>
          <View style={estilos.filaChips}>
            <Pressable
              onPress={() => setOrigen('ingresos')}
              style={[estilos.chip, origen === 'ingresos' && estilos.chipActivo]}
            >
              <Text style={[estilos.textoChip, origen === 'ingresos' && estilos.textoChipActivo]}>
                De mi presupuesto
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setOrigen('externo')}
              style={[estilos.chip, origen === 'externo' && estilos.chipActivo]}
            >
              <Text style={[estilos.textoChip, origen === 'externo' && estilos.textoChipActivo]}>
                Aporte externo
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={montoTexto}
            onChangeText={(t) => {
              setMontoTexto(t);
              setError(null);
            }}
            placeholder="Monto a ahorrar"
            keyboardType="decimal-pad"
            style={estilos.input}
          />
          <Toast texto={error} tipo="error" colors={colors} />
          <Pressable style={[estilos.boton, enviando && estilos.botonDeshabilitado]} onPress={mandarAAhorro} disabled={enviando}>
            <Text style={estilos.textoBoton}>{enviando ? 'Mandando...' : 'Mandar a ahorro'}</Text>
          </Pressable>
        </View>

        <FlatList
          data={movimientosOrdenados}
          keyExtractor={(m) => m.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={estilos.filaMovimiento}>
              <View>
                <Text style={estilos.fechaMovimiento}>{item.fecha}</Text>
                <Text style={estilos.etiquetaOrigen}>
                  {(item.origen ?? 'ingresos') === 'ingresos' ? 'De presupuesto' : 'Aporte externo'}
                </Text>
              </View>
              <Text style={estilos.montoMovimiento}>{formatCentavos(item.centavosArs)}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={estilos.vacio}>Todavía no mandaste nada a ahorro.</Text>}
        />
      </ScrollView>

      <Pressable style={estilos.botonFlotante} onPress={() => router.push('/objetivo-nuevo')}>
        <IconPlus color={colors.onPrimary} size={26} />
      </Pressable>
    </PantallaAnimada>
  );
}

function crearEstilos(colors: Colors) {
  const sombra = { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as const;

  return StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: colors.bg },
    contenido: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
    tarjetaTotal: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md, ...sombra },
    etiqueta: { color: colors.text3, marginTop: spacing.xs },
    montoGrande: { fontSize: 28, fontWeight: '700', color: colors.text1 },
    tituloSeccion: { color: colors.text2, fontWeight: '700', fontSize: 16, marginBottom: spacing.sm },
    vacio: { color: colors.text3, textAlign: 'center', marginBottom: spacing.md },
    listaObjetivos: { marginBottom: spacing.md },
    tarjetaObjetivo: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.xs, ...sombra },
    filaObjetivo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    nombreObjetivo: { color: colors.text1, fontWeight: '700' },
    tamanoObjetivo: { color: colors.text3, fontSize: 11, textTransform: 'uppercase' },
    barraFondo: { height: 8, borderRadius: 4, backgroundColor: colors.surface2, overflow: 'hidden', marginVertical: spacing.xs },
    barraRelleno: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
    montoObjetivo: { color: colors.text2, fontSize: 13 },
    porcentajeObjetivo: { color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
    fechaObjetivo: { color: colors.text3, fontSize: 11, marginTop: 2 },
    formulario: { marginBottom: spacing.md },
    filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    chipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    textoChip: { color: colors.text2 },
    textoChipActivo: { color: colors.onPrimary },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm, backgroundColor: colors.surface },
    boton: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
    botonDeshabilitado: { opacity: 0.6 },
    textoBoton: { color: colors.onPrimary, fontWeight: '700' },
    filaMovimiento: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.xs },
    fechaMovimiento: { color: colors.text3 },
    etiquetaOrigen: { color: colors.text3, fontSize: 11, marginTop: 2 },
    montoMovimiento: { color: colors.primaryDark, fontWeight: '700' },
    botonFlotante: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
    },
  });
}
