/**
 * useCopyToClipboard.js — clipboard copy with transient "copied" feedback state.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { copyToClipboard } from '../utils/helpers';

/**
 * @returns {{ copy, copied }}
 *   copy(text)  — copies the given text and sets `copied` true for 2 seconds
 *   copied      — boolean, true immediately after a successful copy
 */
export function useCopyToClipboard() {
  const [copied, setCopied]  = useState(false);
  // ERR-06: store the timer ID so it can be cancelled on unmount, preventing
  // a state update on an unmounted component warning.
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const copy = useCallback(async (text) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setCopied(false);
      }, 2000);
    }
  }, []);

  return { copy, copied };
}
