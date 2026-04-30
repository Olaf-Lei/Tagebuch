import { useWindowDimensions } from 'react-native';

export function useLayout() {
  const { width } = useWindowDimensions();
  const isWide = width >= 700;
  return {
    isWide,
    width,
    // ~88 % der Breite; Formulare max 860px, Listen/Stats max 1200px
    formMaxWidth: isWide ? Math.min(Math.round(width * 0.88), 860) : undefined,
    listMaxWidth: isWide ? Math.min(Math.round(width * 0.9), 1200) : undefined,
  };
}
