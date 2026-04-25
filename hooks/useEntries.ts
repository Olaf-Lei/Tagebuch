import { useCallback, useEffect, useState } from 'react';
import { getEntries, type Entry } from '../db/entries';

interface Filters {
  search?: string;
  categoryIds?: number[];
  tagIds?: number[];
  startTime?: number;
  endTime?: number;
}

export function useEntries(filters: Filters = {}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const catKey = filters.categoryIds?.join(',') ?? '';
  const tagKey = filters.tagIds?.join(',') ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEntries(filters);
      setEntries(data);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, catKey, tagKey, filters.startTime, filters.endTime]);

  useEffect(() => { load(); }, [load]);

  return { entries, loading, reload: load };
}
