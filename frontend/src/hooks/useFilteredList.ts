import { useMemo } from 'react';

/**
 * Generic list filter hook that replaces 8+ duplicated useMemo filter blocks.
 *
 * @param items        The full list of items to filter.
 * @param search       Current search keyword (will be trimmed & lowercased).
 * @param statusFilter Current status filter value, or 'ALL' to skip.
 * @param opts.statusField   Function to extract the status string from an item.
 * @param opts.searchFields  Function to extract searchable strings from an item.
 */
export function useFilteredList<T>(
  items: T[],
  search: string,
  statusFilter: string,
  opts: {
    statusField: (item: T) => string;
    searchFields: (item: T) => string[];
    extraFilter?: (item: T) => boolean;
  },
): T[] {
  return useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter(item => {
      if (statusFilter !== 'ALL' && opts.statusField(item) !== statusFilter) return false;
      if (opts.extraFilter && !opts.extraFilter(item)) return false;
      if (!keyword) return true;
      const searchable = opts.searchFields(item).join(' ').toLowerCase();
      return searchable.includes(keyword);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, statusFilter]);
}
