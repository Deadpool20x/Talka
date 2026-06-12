'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  WS_RECONNECT_MAX_RETRIES,
  WS_RECONNECT_BASE_DELAY,
  WS_RECONNECT_MAX_DELAY,
} from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';

interface GatewayState {
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;
}

export function useGateway() {
  const { isAuthenticated } = useAuthStore();
  const [state, setState] = useState<GatewayState>({
    isConnected: false,
    isConnecting: false,
    lastError: null,
  });

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks rooms to re-join after reconnect (EVENT_PROTOCOL.md §7)
  const joinedRooms = useRef<Set<string>>(new Set());
  // Prevents reconnect loop after intentional disconnect
  const isIntentionalClose = useRef(false);
  // Ref mirror of isConnecting — always current inside stable useCallback closures
  const isConnectingRef = useRef(false);

  const connect = useCallback(async () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;
    if (socketRef.current?.readyState === WebSocket.CONNECTING) return;
    // Guard: prevent overlapping connect() calls that race on async getSession().
    // Uses a ref (not state) to avoid the stale closure problem inside useCallback.
    if (isConnectingRef.current) return;

    isIntentionalClose.current = false;
    isConnectingRef.current = true;
    setState((s) => ({ ...s, isConnecting: true, lastError: null }));

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setState((s) => ({ ...s, isConnecting: false, lastError: 'No auth token' }));
        return;
      }

      const wsUrl = `${process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/^http/, 'ws')}/ws?token=${session.access_token}`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttempts.current = 0;
        // Emit authenticate event per EVENT_PROTOCOL.md §2.1
        socket.send(
          JSON.stringify({
            event: 'authenticate',
            payload: { token: session.access_token },
          }),
        );
      };

      const handleAuthSuccess = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'auth_success') {
            isConnectingRef.current = false;
            setState({ isConnected: true, isConnecting: false, lastError: null });
            socket.removeEventListener('message', handleAuthSuccess);

            // Delay re-join by 100ms to let the gateway fully register the
            // connection before emitting join_conversation events.
            // Without this, the gateway can receive join before it has
            // flushed the old connection, causing duplicate "User joined" logs.
            setTimeout(() => {
              // Only re-join if this socket is still the live one
              if (socket !== socketRef.current || socket.readyState !== WebSocket.OPEN) return;
              joinedRooms.current.forEach((roomId) => {
                socket.send(
                  JSON.stringify({
                    event: 'join_conversation',
                    payload: { conversation_id: roomId },
                  }),
                );
              });
            }, 100);
          }
        } catch {
          // ignore parsing errors
        }
      };

      socket.addEventListener('message', handleAuthSuccess);

      socket.onclose = (event) => {
        // Stale-socket guard: if this socket was displaced by a new connection
        // (gateway sent a new auth_success to a newer socket), do NOT null out
        // socketRef.current or schedule a reconnect — that would sabotage the
        // live connection and create the infinite reconnection loop.
        if (socket !== socketRef.current) return;

        socketRef.current = null;
        isConnectingRef.current = false;
        setState((s) => ({ ...s, isConnected: false, isConnecting: false }));

        if (
          !event.wasClean &&
          !isIntentionalClose.current &&
          reconnectAttempts.current < WS_RECONNECT_MAX_RETRIES
        ) {
          // Exponential backoff — capped at WS_RECONNECT_MAX_DELAY
          const delay = Math.min(
            WS_RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current),
            WS_RECONNECT_MAX_DELAY,
          );
          reconnectAttempts.current++;
          reconnectTimer.current = setTimeout(connect, delay);
        }
      };

      socket.onerror = () => {
        setState((s) => ({ ...s, lastError: 'WebSocket connection error' }));
        // onclose fires after onerror — reconnect logic lives there
      };
    } catch {
      setState((s) => ({ ...s, isConnecting: false, lastError: 'Connection failed' }));
    }
  }, []); // stable — no deps that change

  const disconnect = useCallback(() => {
    isIntentionalClose.current = true;
    isConnectingRef.current = false;
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    reconnectAttempts.current = WS_RECONNECT_MAX_RETRIES;
    socketRef.current?.close(1000, 'Client disconnect');
  }, []);

  /** Send any event to the Gateway. Returns false if socket is not open. */
  const sendEvent = useCallback((event: string, payload: unknown): boolean => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ event, payload }));
      return true;
    }
    return false;
  }, []);

  const joinRoom = useCallback(
    (conversationId: string): boolean => {
      joinedRooms.current.add(conversationId);
      return sendEvent('join_conversation', { conversation_id: conversationId });
    },
    [sendEvent],
  );

  const leaveRoom = useCallback(
    (conversationId: string): boolean => {
      joinedRooms.current.delete(conversationId);
      return sendEvent('leave_conversation', { conversation_id: conversationId });
    },
    [sendEvent],
  );

  /** Send a heartbeat ping (EVENT_PROTOCOL.md §2.7) */
  const sendHeartbeat = useCallback(() => {
    return sendEvent('heartbeat', {});
  }, [sendEvent]);

  // Auto-connect when authenticated, disconnect on unmount/sign-out
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [connect, disconnect, isAuthenticated]);

  return {
    ...state,
    socketRef,
    connect,
    disconnect,
    sendEvent,
    joinRoom,
    leaveRoom,
    sendHeartbeat,
  };
}
