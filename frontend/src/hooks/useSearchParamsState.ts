import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * A hook that synchronizes a local state with a URL search parameter.
 * 
 * @param key The URL search parameter key.
 * @param defaultValue The default value if the key is not present in the URL.
 * @returns A tuple containing the current value and a setter function.
 */
export function useSearchParamsState<T extends string = string>(
  key: string,
  defaultValue: T
): [T, (newValue: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(() => {
    return (searchParams.get(key) as T) || defaultValue;
  }, [searchParams, key, defaultValue]);

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
    },
    [key, defaultValue, setSearchParams]
  );

  return [value, setValue];
}
