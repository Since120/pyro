// apps/dashboard/src/hooks/use.resettable.state.ts
import { useState, useEffect } from 'react';

/**
 * useResettableState
 * Initialisiert einen Zustand mit einem Anfangswert und setzt ihn zurück,
 * wenn sich eine oder mehrere Abhängigkeiten ändern.
 *
 * @param initialValue - Der anfängliche Wert des Zustands.
 * @param deps - Abhängigkeiten, bei deren Änderung der Zustand zurückgesetzt wird.
 * @returns [state, setState]
 */
export function useResettableState<T>(initialValue: T, deps: any[] = []): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(initialValue);

  useEffect(() => {
    setState(initialValue);
  }, deps); // Wenn z.B. initialData oder open sich ändern, wird der Zustand zurückgesetzt

  return [state, setState];
}
