import { Platform } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

const CONTENT_GAP = 24;

// Bottom padding for scrollable tab content. The tab bar floats over content
// on iOS only (see app/(tabs)/_layout.tsx), so Android needs just the gap.
export function useTabBarPadding() {
  const tabBarHeight = useBottomTabBarHeight();
  return (Platform.OS === 'ios' ? tabBarHeight : 0) + CONTENT_GAP;
}
