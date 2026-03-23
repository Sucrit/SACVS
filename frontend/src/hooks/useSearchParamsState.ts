import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

interface SearchParamsStateOptions {
  persist?: boolean;
  storageKey?: string;
}

/**
 * A hook that synchronizes a local state with a URL search parameter.
 * 
 * @param key The URL search parameter key.
 * @param defaultValue The default value if the key is not present in the URL.
 * @returns A tuple containing the current value and a setter function.
 */
export function useSearchParamsState<T extends string = string>(
  key: string,
  defaultValue: T,
  options?: SearchParamsStateOptions,
): [T, (newValue: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const persist = options?.persist ?? false;
  const storageKey = options?.storageKey;
  const hasUrlValue = searchParams.has(key);

  const value = useMemo(() => {
    return (searchParams.get(key) as T) || defaultValue;
  }, [searchParams, key, defaultValue]);

  useEffect(() => {
    if (!persist || !storageKey || typeof window === 'undefined') return;
    if (hasUrlValue) return;

    const storedValue = window.localStorage.getItem(storageKey);
    if (!storedValue || storedValue === defaultValue) return;

    setSearchParams(
      prev => {
        if (prev.has(key)) return prev;
        const next = new URLSearchParams(prev);
        next.set(key, storedValue);
        return next;
      },
      { replace: true },
    );
  }, [defaultValue, hasUrlValue, key, persist, setSearchParams, storageKey]);

  useEffect(() => {
    if (!persist || !storageKey || typeof window === 'undefined') return;

    if (value === defaultValue) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, value);
  }, [defaultValue, persist, storageKey, value]);

  const setValue = useCallback(
    (newValue: T) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newValue === defaultValue) {
            next.delete(key);
          } else {
            next.set(key, newValue);
          }
          return next;
        },
        { replace: true }
      );

      if (persist && storageKey && typeof window !== 'undefined') {
        if (newValue === defaultValue) {
          window.localStorage.removeItem(storageKey);
        } else {
          window.localStorage.setItem(storageKey, newValue);
        }
      }
    },
    [defaultValue, key, persist, setSearchParams, storageKey]
  );

  return [value, setValue];
}
