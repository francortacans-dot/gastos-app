import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Link, usePathname, useRouter } from 'expo-router';
import { useColors } from '../theme/theme-context';
import type { Colors } from '../theme/palettes';
import { spacing } from '../theme/spacing';
import { IconHome, IconHistorial, IconSectores, IconAhorro, IconSettings, type IconProps } from './icons';

const TABS: { href: '/' | '/historial' | '/sectores' | '/ahorro'; label: string; Icon: (p: IconProps) => React.ReactElement }[] = [
  { href: '/', label: 'Inicio', Icon: IconHome },
  { href: '/historial', label: 'Historial', Icon: IconHistorial },
  { href: '/sectores', label: 'Sectores', Icon: IconSectores },
  { href: '/ahorro', label: 'Ahorro', Icon: IconAhorro },
];

export function AppHeader() {
  const colors = useColors();
  const estilos = useMemo(() => crearEstilos(colors), [colors]);
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.filaTitulo}>
        <Text style={estilos.titulo}>Mis gastos</Text>
        <Pressable onPress={() => router.push('/config')} style={estilos.botonConfig} hitSlop={8}>
          <IconSettings color={colors.text1} size={24} />
        </Pressable>
      </View>
      <View style={estilos.filaTabs}>
        {TABS.map(({ href, label, Icon }) => {
          const activo = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} asChild>
              <Pressable style={[estilos.tab, activo && estilos.tabActivo]}>
                <Icon color={activo ? colors.primary : colors.text3} size={20} />
                <Text style={[estilos.textoTab, activo && estilos.textoTabActivo]}>{label}</Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </View>
  );
}

function crearEstilos(colors: Colors) {
  return StyleSheet.create({
    contenedor: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    filaTitulo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    titulo: { fontSize: 22, fontWeight: '700', color: colors.primary },
    botonConfig: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface2,
    },
    filaTabs: { flexDirection: 'row', paddingHorizontal: spacing.sm, gap: spacing.xs, paddingBottom: spacing.sm },
    tab: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingVertical: spacing.xs,
      borderRadius: 10,
    },
    tabActivo: { backgroundColor: colors.primaryLight },
    textoTab: { fontSize: 11, color: colors.text3, fontWeight: '600' },
    textoTabActivo: { color: colors.primaryDark },
  });
}
