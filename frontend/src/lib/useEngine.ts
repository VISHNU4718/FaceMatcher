import { useEffect, useSyncExternalStore } from 'react';
import { EngineState, getEngineState, loadEngine, subscribeEngine } from './engine';

/** Current model-loading state. Starts loading the models the first time it is used. */
export function useEngine(): EngineState & { retry: () => void } {
  const state = useSyncExternalStore(subscribeEngine, getEngineState);
  useEffect(() => {
    if (state.status === 'idle') loadEngine().catch(() => undefined);
  }, [state.status]);
  return { ...state, retry: () => void loadEngine().catch(() => undefined) };
}
