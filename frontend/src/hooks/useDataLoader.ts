import { useCallback, useRef, useState } from 'react';
import { useToast } from './useToast';
import { toErrorMessage } from '../utils/errors';

interface DataLoaderResult<T> {
  data: T;
  isLoading: boolean;
  hasLoaded: boolean;
  load: (options?: { silent?: boolean }) => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T>>;
}

/**
 * Generic data-loading hook that replaces the repeated try/catch + loading/hasLoaded pattern
 * found in every dashboard component.
 *
 * @param fetcher   Async function that returns the data.
 * @param errorMsg  Fallback error message shown in toast on failure.
 * @param initial   Initial value for `data` (defaults depend on T).
 */
export function useDataLoader<T>(
  fetcher: () => Promise<T>,
  errorMsg: string,
  initial: T,
): DataLoaderResult<T> {
  const [data, setData] = useState<T>(initial);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const { showToast } = useToast();
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setIsLoading(true);
      try {
        const result = await fetcherRef.current();
        setData(result);
        setHasLoaded(true);
      } catch (error) {
        console.error(`[useDataLoader] ${errorMsg}:`, error);
        if (!silent) {
          setData(initial);
          showToast({ variant: 'error', message: toErrorMessage(error, errorMsg) });
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    // errorMsg and initial are stable constants from the call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [errorMsg, showToast],
  );

  return { data, isLoading, hasLoaded, load, setData };
}
