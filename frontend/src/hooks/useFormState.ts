import { useCallback, useState } from 'react';

/**
 * Generic form state hook that replaces duplicated create/edit form patterns.
 *
 * Returns form values, a type-safe setter for individual fields, reset to defaults,
 * and a bulk setter for populating all fields at once (e.g. when starting an edit).
 */
export function useFormState<T extends Record<string, unknown>>(defaultValues: T) {
  const [values, setValues] = useState<T>(defaultValues);

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback(() => {
    setValues(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAll = useCallback((newValues: T) => {
    setValues(newValues);
  }, []);

  return { values, setValue, reset, setAll };
}
