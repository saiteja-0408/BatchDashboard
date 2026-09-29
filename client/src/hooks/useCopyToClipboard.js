/**
 * useCopyToClipboard.js — clipboard copy with transient "copied" feedback state.
 */

import { useState, useCallback } from 'react';
import { copyToClipboard } from '../utils/helpers';

/**
 * @returns {{ copy, copied }}
 *   copy(text)  — copies the given text and sets `copied` true for 2 seconds
 *   copied      — boolean, true immediately after a successful copy
 */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  return { copy, copied };
}
