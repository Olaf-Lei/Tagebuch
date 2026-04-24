import { useEffect, useState } from 'react';
import { getTags, searchTags, type Tag } from '../db/tags';

export function useTags(query?: string) {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (query && query.length > 0) {
      searchTags(query).then(setTags);
    } else {
      getTags().then(setTags);
    }
  }, [query]);

  return tags;
}
