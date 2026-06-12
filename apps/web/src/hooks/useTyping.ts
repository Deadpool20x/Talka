'use client';

import { useCallback, useRef } from 'react';
import { TYPING_DEBOUNCE_MS } from '@/lib/constants';

/**
 * useTyping — manages typing indicator with leading-edge send and debounced stop.
 *
 * Strategy:
 *  - First keystroke → immediately sends is_typing=true (leading edge)
 *  - Each subsequent keystroke resets the debounce timer
 *  - After TYPING_DEBOUNCE_MS of silence → sends is_typing=false
 *  - stopTyping() can cancel immediately (e.g. on message send or blur)
 */
export function useTyping(sendEvent: (event: string, payload: unknown) => boolean) {
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  const sendTyping = useCallback(
    (conversationId: string, typing: boolean) => {
      sendEvent('typing', {
        conversation_id: conversationId,
        is_typing: typing,
      });
    },
    [sendEvent],
  );

  /**
   * Call on every input change event.
   * Sends leading-edge true, then debounces the false signal.
   */
  const startTyping = useCallback(
    (conversationId: string) => {
      // Leading edge: only send true once per typing burst
      if (!isTyping.current) {
        isTyping.current = true;
        sendTyping(conversationId, true);
      }

      // Reset debounce window
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        isTyping.current = false;
        sendTyping(conversationId, false);
        typingTimer.current = null;
      }, TYPING_DEBOUNCE_MS);
    },
    [sendTyping],
  );

  /**
   * Call on message send or input blur to immediately stop the indicator.
   */
  const stopTyping = useCallback(
    (conversationId: string) => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
        typingTimer.current = null;
      }
      if (isTyping.current) {
        isTyping.current = false;
        sendTyping(conversationId, false);
      }
    },
    [sendTyping],
  );

  return { startTyping, stopTyping };
}
