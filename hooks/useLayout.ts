import { useWindowDimensions } from 'react-native';

export function useLayout() {
  const { width } = useWindowDimensions();
  return { isWide: width >= 700 };
}
