import { useCallback, useRef, useState } from 'react';
import { clearParentalCommerce } from '../store/compliance';

/** Every purchase, restore, sign-in and legal link asks the gate again. */
export function useParentalCommerceGate() {
  const [gateOpen, setGateOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const runGuarded = useCallback((action: () => void) => {
    pending.current = action;
    setGateOpen(true);
  }, []);

  const confirmGate = useCallback(() => {
    clearParentalCommerce();
    setGateOpen(false);
    const action = pending.current;
    pending.current = null;
    action?.();
  }, []);

  const cancelGate = useCallback(() => {
    clearParentalCommerce();
    setGateOpen(false);
    pending.current = null;
  }, []);

  return { gateOpen, runGuarded, confirmGate, cancelGate };
}
