import { useCallback, useEffect, useState } from 'react';
import { getEntries, type Entry } from '../db/entries';

interface Filters {
  search?: string;
  categoryId?: number;
  tagId?: number;
  startTime?: number;
  endTime?: number;
}

export function useEntries(filters: Filters = {}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEntries(filters);
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.categoryId, filters.tagId, filters.startTime, filters.endTime]);

  useEffect(() => { load(); }, [load]);

  return { entries, loading, reload: load };
}
