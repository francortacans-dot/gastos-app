import React from 'react';
import { Tabs } from 'expo-router';
import { AppHeader } from '../../src/components/app-header';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        header: () => <AppHeader />,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="historial" />
      <Tabs.Screen name="sectores" />
      <Tabs.Screen name="ahorro" />
      <Tabs.Screen name="inversiones" />
    </Tabs>
  );
}
