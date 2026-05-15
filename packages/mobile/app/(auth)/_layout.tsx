import { Stack, Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '@clerk/clerk-react';
import { View, ActivityIndicator } from 'react-native';
import { useSemanticColor } from '@/hooks/useThemeColor';

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const primaryColor = useSemanticColor('primary');

  // Show loading screen while Clerk loads
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  // If signed in, redirect to the main app, but only when directly accessing auth screens
  // This allows signed-in users to still view demo content if they choose to
  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack 
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'white' },
        animation: 'slide_from_right',
      }}
      initialRouteName="index"
    >
      <Stack.Screen 
        name="index" 
        options={{
          // Ensure this screen is shown first
          animation: 'none'
        }}
      />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="welcome" />
    </Stack>
  );
} 