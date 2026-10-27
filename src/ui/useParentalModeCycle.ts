import { useCallback, useState } from 'react';
import { grantParentalCommerce } from '../store/compliance';
import { MODES, useProfile } from '../store/profile';

/** Tap-to-cycle mode; Toybox → Arcade requires parental gate first. */
export function useParentalModeCycle() {
  const [gateOpen, setGateOpen] = useState(false);

  const requestCycle = useCallback(() => {
    const st = useProfile.getState();
    const next = MODES[(MODES.indexOf(st.mode) + 1) % MODES.length];
    if (st.mode === 'TOYBOX' && next === 'ARCADE') setGateOpen(true);
    else st.cycleMode();
  }, []);

  const confirmGate = useCallback(() => {
    setGateOpen(false);
    grantParentalCommerce();
    useProfile.getState().cycleMode();
  }, []);

  const cancelGate = useCallback(() => setGateOpen(false), []);

  return { gateOpen, requestCycle, confirmGate, cancelGate };
}
