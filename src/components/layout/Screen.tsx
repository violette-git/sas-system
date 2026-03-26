import { View, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, SIDEBAR_WIDTH, BOTTOM_TAB_HEIGHT, Breakpoints } from '@/theme';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Root screen wrapper that automatically applies left padding equal to the
 * sidebar width on desktop/tablet. Each screen manages its own scrolling.
 * Use `useContentPadding()` for ScrollView/FlatList contentContainerStyle.
 */
export function Screen({ children, style }: ScreenProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= Breakpoints.tablet;

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.bg,
          paddingLeft: isDesktop ? SIDEBAR_WIDTH : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Returns the appropriate content bottom padding for scrollable screens.
 * Use this in ScrollView/FlatList contentContainerStyle.
 */
export function useContentPadding(): { paddingBottom: number } {
  const { width } = useWindowDimensions();
  const insets    = useSafeAreaInsets();
  const isDesktop = width >= Breakpoints.tablet;
  return {
    paddingBottom: isDesktop ? insets.bottom + 16 : BOTTOM_TAB_HEIGHT + insets.bottom + 16,
  };
}
