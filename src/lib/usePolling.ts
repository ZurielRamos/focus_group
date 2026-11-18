"use client";

import { useCallback, useEffect, useState } from "react";

// Consulta `url` cada `intervalMs`. `refresh()` fuerza una consulta inmediata.
export function usePolling<T>(url: string, intervalMs = 2000) {
  const [data, setData] = useState<T | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      let retry = true;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (stopped) return;
        if (res.status === 404) {
          setNotFound(true);
          retry = false;
        } else if (res.ok) {
          setData((await res.json()) as T);
          setFailed(false);
        } else {
          setFailed(true);
        }
      } catch {
        // error de red: se reintenta en el siguiente ciclo
        if (!stopped) setFailed(true);
      }
      if (retry && !stopped) timer = setTimeout(load, intervalMs);
    }

    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [url, intervalMs, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, notFound, failed, refresh };
}
