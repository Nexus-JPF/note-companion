import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-react';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, Animated } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSemanticColor } from '@/hooks/useThemeColor';
import { HapticTab } from '@/components/HapticTab';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TabBarBackground from '@/components/ui/TabBarBackground';
// Import the custom CameraTabButton
import CameraTabButton from '@/components/ui/CameraTabButton';

interface TabIconProps {
  color: string;
  size: number;
  focused: boolean;
}

// Explicitly type the icon name
type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  
  // Get colors from our semantic theme system
  const primaryColor = useSemanticColor('primary');
  const tabIconDefaultColor = useSemanticColor('tabIconDefault');
  const backgroundColor = useSemanticColor('background');
  const tabBarColor = useSemanticColor('tabBar');
  
  // Authentication redirect logic
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      // Give auth a moment to restore from storage before redirecting
      const authTimeout = setTimeout(() => {
        router.replace('/(auth)'); // Redirect to auth index instead of sign-in directly
      }, 1000); // Wait 1 second before redirecting to allow token restore
      
      return () => clearTimeout(authTimeout);
    }
  }, [isLoaded, isSignedIn]);

  // Show nothing while auth is loading to prevent flash
  if (!isLoaded) {
    return null;
  }
  
  // If not signed in, we'll be redirected by the useEffect, but still render
  // to prevent flashing during the delay
  if (!isSignedIn) {
    return null;
  }

  // Determine header style based on platform
  const headerStyle = Platform.OS === 'ios' ? {
    headerStyle: {
      backgroundColor: 'transparent',
    },
    headerTitleStyle: {
      fontWeight: '600' as const,
    },
    // For iOS, use translucent header with blur effect
    headerTransparent: true,
    headerBlurEffect: theme === 'dark' ? 'systemChromeMaterialDark' as const : 'systemChromeMaterial' as const,
  } : {
    headerStyle: {
      backgroundColor,
    },
    headerTitleStyle: {
      fontWeight: '600' as const,
    },
  };

  // Custom tab bar icon with animation
  const renderTabIcon = (props: TabIconProps, iconName: MaterialIconName) => {
    const { color, size, focused } = props;
    return (
      <MaterialIcons
        name={iconName}
        size={size}
        color={color}
        style={{
          transform: [{ scale: focused ? 1.1 : 1 }],
        }}
      />
    );
  };

  return (
    <Tabs 
      screenOptions={{
        // Common Tab bar styling
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: tabIconDefaultColor,
        tabBarStyle: {
          backgroundColor: tabBarColor,
          borderTopColor: 'rgba(0,0,0,0.05)',
          borderTopWidth: StyleSheet.hairlineWidth,
          ...(Platform.OS === 'ios' ? {
            position: 'absolute',
            height: 49 + insets.bottom,
          } : {}),
        },
        tabBarBackground: () => <TabBarBackground />,
        tabBarShowLabel: true,
        headerShown: false,
        tabBarHideOnKeyboard: true,
        ...headerStyle, // Apply common header styles
      }}
    >
      {/* Regular Tabs using HapticTab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }: TabIconProps) => renderTabIcon({ color, size, focused }, 'home'),
          tabBarButton: (props) => (
            <HapticTab {...(props as unknown as React.ComponentProps<typeof HapticTab>)} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'My Notes',
          tabBarIcon: ({ color, size, focused }: TabIconProps) => renderTabIcon({ color, size, focused }, 'note'),
          tabBarButton: (props) => (
            <HapticTab {...(props as unknown as React.ComponentProps<typeof HapticTab>)} />
          ),
        }}
      />
      
      {/* Camera Tab using CameraTabButton */}
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Capture',
          tabBarIcon: ({ color, size, focused }: TabIconProps) => renderTabIcon({ color, size, focused }, 'camera-alt'),
          tabBarButton: (props) => (
            <CameraTabButton {...(props as unknown as React.ComponentProps<typeof CameraTabButton>)} />
          ),
        }}
      />
      
      {/* Regular Tabs using HapticTab */}
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          tabBarIcon: ({ color, size, focused }: TabIconProps) => renderTabIcon({ color, size, focused }, 'sync'),
          tabBarButton: (props) => (
            <HapticTab {...(props as unknown as React.ComponentProps<typeof HapticTab>)} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }: TabIconProps) => renderTabIcon({ color, size, focused }, 'settings'),
          tabBarButton: (props) => (
            <HapticTab {...(props as unknown as React.ComponentProps<typeof HapticTab>)} />
          ),
        }}
      />
    </Tabs>
  );
}