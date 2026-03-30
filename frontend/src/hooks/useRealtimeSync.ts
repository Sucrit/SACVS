import { useCallback, useEffect, useRef } from 'react';
import { realtimeService, RealtimeEventEnvelope } from '../services/realtime.service';

type DomainRefreshMap = Record<string, () => void>;

/**
 * Encapsulates the realtime subscription + debounced refresh pattern duplicated
 * across StudentDashboard, InstitutionDashboard, and AdminDashboard.
 *
 * @param domainMap  Maps realtime event domains (or `domain:action`) to refresh callbacks.
 * @param debounceMs Debounce interval in ms (default 350).
 */
export function useRealtimeSync(
  domainMap: DomainRefreshMap,
  debounceMs = 350,
): void {
  const domainMapRef = useRef(domainMap);
  domainMapRef.current = domainMap;

  const timersRef = useRef<Record<string, number | null>>({});

  const scheduleRefresh = useCallback(
    (key: string) => {
      if (timersRef.current[key]) return;
      timersRef.current[key] = window.setTimeout(() => {
        timersRef.current[key] = null;
        domainMapRef.current[key]?.();
      }, debounceMs);
    },
    [debounceMs],
  );

  useEffect(() => {
    const unsubscribe = realtimeService.subscribe((event: RealtimeEventEnvelope) => {
      const domainActionKey = `${event.domain}:${event.action}`;

      // Check for an exact domain:action match first, then fall back to domain-only
      if (domainMapRef.current[domainActionKey]) {
        scheduleRefresh(domainActionKey);
      } else if (domainMapRef.current[event.domain]) {
        scheduleRefresh(event.domain);
      }
    });

    return () => {
      unsubscribe();
      Object.keys(timersRef.current).forEach(key => {
        const timer = timersRef.current[key];
        if (timer) {
          window.clearTimeout(timer);
          timersRef.current[key] = null;
        }
      });
    };
  }, [scheduleRefresh]);
}
