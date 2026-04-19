// WebSocket Tracking Service using native WebSocket API
// Compatible with Socket.IO servers via fallback

import type { DriverLocation } from '@/fleet/types/fleet';

const WS_URL = import.meta.env.VITE_FLEET_WS_URL || 'ws://localhost:3001';

export interface TrackingSocketConfig {
  token: string;
  userRole: 'super_admin' | 'fleet_manager';
  assignedCities?: string[];
  onDriverLocation?: (location: DriverLocation) => void;
  onDriverStatusChange?: (data: { driverId: string; currentStatus: string; driverName: string }) => void;
  onFleetStatsUpdate?: (stats: { cityId: string; totalDrivers: number; onlineDrivers: number; activeOrders: number }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

interface WebSocketMessage {
  event: string;
  data: unknown;
}

class TrackingSocketService {
  private ws: WebSocket | null = null;
  private config: TrackingSocketConfig | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];

  connect(config: TrackingSocketConfig): void {
    this.config = config;
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[TrackingSocket] Already connected');
      return;
    }

    try {
      // Connect with token as query parameter
      const url = `${WS_URL}?token=${encodeURIComponent(config.token)}`;
      this.ws = new WebSocket(url);

      this.setupEventHandlers();
    } catch (error) {
      console.error('[TrackingSocket] Connection error:', error);
      config.onError?.(error as Error);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[TrackingSocket] Connected');
      this.reconnectAttempts = 0;
      this.config?.onConnect?.();

      // Subscribe to cities based on user role
      if (this.config?.userRole === 'super_admin') {
        this.send('fleet:subscribe_city', { cityId: 'all' });
      } else if (this.config?.assignedCities) {
        this.config.assignedCities.forEach(cityId => {
          this.send('fleet:subscribe_city', { cityId });
        });
      }

      // Flush message queue
      this.flushMessageQueue();
    };

    this.ws.onclose = () => {
      console.log('[TrackingSocket] Disconnected');
      this.config?.onDisconnect?.();
      this.scheduleReconnect();
    };

    this.ws.onerror = (event) => {
      console.error('[TrackingSocket] WebSocket error:', event);
      this.config?.onError?.(new Error('WebSocket error'));
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[TrackingSocket] Failed to parse message:', error);
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    const { event, data } = message;

    switch (event) {
      case 'fleet:driver_location':
        if (this.isDriverLocation(data)) {
          this.config?.onDriverLocation?.(data);
        }
        break;

      case 'fleet:driver_status':
        if (this.isDriverStatusData(data)) {
          this.config?.onDriverStatusChange?.(data);
        }
        break;

      case 'fleet:stats_update':
        if (this.isFleetStatsData(data)) {
          this.config?.onFleetStatsUpdate?.(data);
        }
        break;

      case 'fleet:subscribed':
        console.log('[TrackingSocket] Subscribed to city:', (data as { cityId: string }).cityId);
        break;

      case 'error': {
        const errorData = data as { message: string };
        console.error('[TrackingSocket] Server error:', errorData);
        this.config?.onError?.(new Error(errorData.message || 'Unknown error'));
        break;
      }

      default:
        console.log('[TrackingSocket] Unknown event:', event);
    }
  }

  private isDriverLocation(data: unknown): data is DriverLocation {
    return (
      typeof data === 'object' &&
      data !== null &&
      'driverId' in data &&
      'latitude' in data &&
      'longitude' in data
    );
  }

  private isDriverStatusData(data: unknown): data is { driverId: string; currentStatus: string; driverName: string } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'driverId' in data &&
      'currentStatus' in data
    );
  }

  private isFleetStatsData(data: unknown): data is { cityId: string; totalDrivers: number; onlineDrivers: number; activeOrders: number } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'cityId' in data &&
      'totalDrivers' in data
    );
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[TrackingSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[TrackingSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      if (this.config) {
        this.connect(this.config);
      }
    }, delay);
  }

  private send(event: string, data: unknown): void {
    const message: WebSocketMessage = { event, data };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws?.send(JSON.stringify(message));
      }
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
      console.log('[TrackingSocket] Disconnected manually');
    }
  }

  subscribeToCity(cityId: string): void {
    if (!this.isConnected()) {
      console.warn('[TrackingSocket] Cannot subscribe: not connected');
      return;
    }

    this.send('fleet:subscribe_city', { cityId });
  }

  unsubscribeFromCity(cityId: string): void {
    if (!this.isConnected()) return;
    
    this.send('fleet:unsubscribe_city', { cityId });
  }

  requestLocationHistory(
    driverId: string, 
    startTime: string, 
    endTime: string
  ): Promise<{ driverId: string; locations: DriverLocation[] }> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error('Not connected to tracking server'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const requestId = `${driverId}_${Date.now()}`;

      const handleResponse = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          if (message.event === 'fleet:location_history') {
            const data = message.data as { driverId: string; locations: DriverLocation[] };
            if (data.driverId === driverId) {
              clearTimeout(timeout);
              this.ws?.removeEventListener('message', handleResponse);
              resolve(data);
            }
          } else if (message.event === 'error') {
            const errorData = message.data as { message: string };
            clearTimeout(timeout);
            this.ws?.removeEventListener('message', handleResponse);
            reject(new Error(errorData.message || 'Request failed'));
          }
        } catch {
          // Ignore parse errors
        }
      };

      this.ws?.addEventListener('message', handleResponse);
      this.send('fleet:request_history', { driverId, startTime, endTime, requestId });
    });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSocketId(): string | null {
    return null; // Native WebSocket doesn't have socket IDs like Socket.IO
  }
}

// Singleton instance
export const trackingSocket = new TrackingSocketService();

// Hook-compatible function for creating new instances
export function createTrackingSocket(): TrackingSocketService {
  return new TrackingSocketService();
}
