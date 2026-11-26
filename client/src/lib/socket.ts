import { io, Socket } from 'socket.io-client';
import { useEffect, useRef } from 'react';

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0');

const SOCKET_URL =
  (import.meta as any).env?.VITE_SOCKET_URL ||
  ((import.meta as any).env?.VITE_API_URL
    ? String((import.meta as any).env.VITE_API_URL).replace(/\/api\/?$/, '')
    : isLocal
      ? 'http://localhost:5000'
      : 'https://velanai-glyp.onrender.com');

let sharedSocket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!sharedSocket) {
    sharedSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
    });
  }
  return sharedSocket;
};

/**
 * Subscribe to real-time Socket.IO events and automatically refetch on reconnect or matching event.
 */
export const useRealtimeSync = (
  events: string[],
  onSync: (payload?: any) => void,
  rooms?: { classId?: string; sessionId?: string; userId?: string }
) => {
  const callbackRef = useRef(onSync);
  callbackRef.current = onSync;

  useEffect(() => {
    const socket = getSocket();

    if (rooms?.userId) {
      socket.emit('join:user', rooms.userId);
    }
    if (rooms?.classId) {
      socket.emit('join:class', rooms.classId);
    }
    if (rooms?.sessionId) {
      socket.emit('join:session', rooms.sessionId);
    }

    const handler = (payload: any) => {
      callbackRef.current(payload);
    };

    const onReconnect = () => {
      if (rooms?.userId) socket.emit('join:user', rooms.userId);
      if (rooms?.classId) socket.emit('join:class', rooms.classId);
      if (rooms?.sessionId) socket.emit('join:session', rooms.sessionId);
      callbackRef.current({ reconnected: true });
    };

    events.forEach((ev) => socket.on(ev, handler));
    socket.on('connect', onReconnect);

    return () => {
      events.forEach((ev) => socket.off(ev, handler));
      socket.off('connect', onReconnect);
    };
  }, [JSON.stringify(events), rooms?.classId, rooms?.sessionId, rooms?.userId]);
};
