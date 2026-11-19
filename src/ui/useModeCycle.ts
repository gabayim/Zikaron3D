import { useCallback } from 'react';
import { useProfile } from '../store/profile';

/** Tap-to-cycle play mode. */
export function useModeCycle() {
  return useCallback(() => useProfile.getState().cycleMode(), []);
}
