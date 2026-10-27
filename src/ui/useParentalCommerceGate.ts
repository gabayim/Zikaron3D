import { useCallback, useRef, useState } from 'react';
import { grantParentalCommerce, isParentalCommerceOk } from '../store/compliance';

/** Run store actions (restore, purchase) behind the math gate when the session is not cleared. */
export function useParentalCommerceGate() {
  const [gateOpen, setGateOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const runGuarded = useCallback((action: () => void) => {
    if (isParentalCommerceOk()) {
      action();
      return;
    }
    pending.current = action;
    setGateOpen(true);
  }, []);

  const confirmGate = useCallback(() => {
    grantParentalCommerce();
    setGateOpen(false);
    pending.current?.();
    pending.current = null;
  }, []);

  const cancelGate = useCallback(() => {
    setGateOpen(false);
    pending.current = null;
  }, []);

  return { gateOpen, runGuarded, confirmGate, cancelGate };
}
