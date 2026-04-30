import { useEffect, useState } from 'react';
import { getActiveQualifiers, type Qualifier } from '../db/qualifiers';

export function useQualifiers(): Qualifier[] {
  const [qualifiers, setQualifiers] = useState<Qualifier[]>([]);
  useEffect(() => {
    getActiveQualifiers().then(setQualifiers);
  }, []);
  return qualifiers;
}
