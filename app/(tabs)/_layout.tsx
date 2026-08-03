import React from 'react';
import { Tabs } from 'expo-router';
import { colors } from '../../src/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text3,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text1,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial' }} />
      <Tabs.Screen name="sectores" options={{ title: 'Sectores' }} />
      <Tabs.Screen name="ahorro" options={{ title: 'Ahorro' }} />
    </Tabs>
  );
}
