'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

// Socket manager that survives HMR
class SocketManager {
  private static instance: Socket | null = null;
  private static listeners: Map<string, Function[]> = new Map();

  static getInstance(): Socket {
    if (!this.instance) {
      this.instance = io({
        path: '/socket.io',
        transports: ['polling'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
        timeout: 15000,
      });

      this.instance.on('connect', () => {
        console.log('Socket connected:', this.instance?.id);
      });

      this.instance.on('disconnect', (reason: string) => {
        console.log('Socket disconnected:', reason);
      });

      this.instance.on('connect_error', (error: Error) => {
        console.error('Socket connection error:', error.message);
      });
    }
    return this.instance;
  }

  static isConnected(): boolean {
    return this.instance?.connected || false;
  }
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const socket = SocketManager.getInstance();
    
    // Only set up listeners once
    if (!initialized.current) {
      initialized.current = true;
      
      const handleConnect = () => {
        setIsConnected(true);
        console.log('Connected:', socket.id);
      };
      
      const handleDisconnect = () => {
        setIsConnected(false);
        console.log('Disconnected');
      };
      
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      
      // Set initial state
      if (socket.connected) {
        setIsConnected(true);
      }

      // Store listeners for cleanup
      SocketManager.listeners.set('connect', [handleConnect]);
      SocketManager.listeners.set('disconnect', [handleDisconnect]);
    }

    // Update connection state periodically for React state sync
    const interval = setInterval(() => {
      setIsConnected(SocketManager.isConnected());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: SocketManager.getInstance(), isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
