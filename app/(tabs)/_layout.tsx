import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useColors } from '../../src/theme/theme-context';

export default function TabsLayout() {
  const router = useRouter();
  const colors = useColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text3,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text1,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          headerRight: () => (
            <Pressable onPress={() => router.push('/config')} style={{ marginRight: 16 }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>⚙</Text>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="historial" options={{ title: 'Historial' }} />
      <Tabs.Screen name="sectores" options={{ title: 'Sectores' }} />
      <Tabs.Screen name="ahorro" options={{ title: 'Ahorro' }} />
    </Tabs>
  );
}
