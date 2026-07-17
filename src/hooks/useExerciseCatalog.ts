import { useEffect, useMemo, useState } from "react";

import {
  loadExerciseCatalog,
  type ExerciseCatalogItem,
} from "@/lib/exercise-catalog";

interface ExerciseCatalogState {
  exercises: ExerciseCatalogItem[];
  loading: boolean;
  error: Error | null;
}

export function useExerciseCatalog(enabled = true): ExerciseCatalogState {
  const [exercises, setExercises] = useState<ExerciseCatalogItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    loadExerciseCatalog()
      .then((catalog) => {
        if (!active) return;
        setExercises(catalog);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason : new Error("Unable to load exercise catalog"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  return useMemo(() => ({ exercises, loading, error }), [error, exercises, loading]);
}

