import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4CAF50',
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Sync',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📱</Text>,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📋</Text>,
        }}
      />
    </Tabs>
  );
}
