/**
 * Fleet Management WebSocket Server
 * Main server with Socket.io, Redis adapter, JWT authentication, and room management
 */

import 'dotenv/config';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { getAdapterClients, closeRedisConnections, checkRedisHealth } from './services/redisService';
import { closeDatabasePool } from './handlers/dbHelper';
import { initializeDriverConnection } from './handlers/driverHandler';
import { initializeFleetConnection } from './handlers/fleetHandler';
import type { SocketUserData } from './types/events';
import { SocketEvents } from './types/events';

// Configuration
const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const WS_MAX_CONNECTIONS = parseInt(process.env.WS_MAX_CONNECTIONS || '10000', 10);
const WS_PING_INTERVAL = parseInt(process.env.WS_PING_INTERVAL || '25000', 10);
const WS_PING_TIMEOUT = parseInt(process.env.WS_PING_TIMEOUT || '60000', 10);
const WS_UPGRADE_TIMEOUT = parseInt(process.env.WS_UPGRADE_TIMEOUT || '10000', 10);
const JWT_SECRET = process.env.JWT_SECRET || '';

// Validate required environment variables
if (!JWT_SECRET) {
  console.error('[Server] FATAL: JWT_SECRET is required');
  process.exit(1);
}

// Create HTTP server
const httpServer = createServer();

// Create Socket.io server with Redis adapter
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  pingInterval: WS_PING_INTERVAL,
  pingTimeout: WS_PING_TIMEOUT,
  upgradeTimeout: WS_UPGRADE_TIMEOUT,
  transports: ['websocket', 'polling'], // Fallback to polling
  perMessageDeflate: {
    threshold: 1024, // Compress messages larger than 1KB
  },
  maxHttpBufferSize: 1e6, // 1MB max message size
});

// Set up Redis adapter for multi-server scaling
const { pubClient, subClient } = getAdapterClients();
io.adapter(createAdapter(pubClient, subClient));

// Connection metrics
let totalConnections = 0;
let driverConnections = 0;
let fleetConnections = 0;

/**
 * JWT Authentication Middleware
 */
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Determine user type from JWT claims
    const userData: SocketUserData = {
      type: decoded.role === 'driver' ? 'driver' : 'fleet',
      userId: decoded.sub || decoded.userId,
      role: decoded.role,
      assignedCities: decoded.assignedCities || [],
    };
    
    if (userData.type === 'driver') {
      userData.driverId = decoded.driverId;
    } else {
      userData.managerId = decoded.userId;
    }
    
    // Store user data on socket
    socket.data.user = userData;
    
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new Error('Token expired'));
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid token'));
    }
    return next(new Error('Authentication failed'));
  }
});

/**
 * Connection Handler
 */
io.on('connection', async (socket) => {
  // Check max connections
  if (totalConnections >= WS_MAX_CONNECTIONS) {
    socket.emit(SocketEvents.ERROR, {
      code: 'SERVER_AT_CAPACITY',
      message: 'Server is at maximum capacity, please try again later',
    });
    socket.disconnect(true);
    return;
  }

  const userData: SocketUserData = socket.data.user;
  
  // Update metrics
  totalConnections++;
  
  if (userData.type === 'driver') {
    driverConnections++;
    await initializeDriverConnection(socket, userData);
  } else {
    fleetConnections++;
    await initializeFleetConnection(socket, userData);
  }
  
  // Log connection
  if (LOG_LEVEL === 'debug') {
    console.log(`[Connection] ${userData.type}: ${userData.userId} (Total: ${totalConnections})`);
  }
  
  // Update connection count on disconnect
  socket.on('disconnect', () => {
    totalConnections--;
    if (userData.type === 'driver') {
      driverConnections--;
    } else {
      fleetConnections--;
    }
    
    if (LOG_LEVEL === 'debug') {
      console.log(`[Connection] Disconnected: ${userData.userId} (Total: ${totalConnections})`);
    }
  });
});

/**
 * Error Handler
 */
io.on('error', (error) => {
  console.error('[Server] Socket.io error:', error);
});

/**
 * Health Check Endpoint
 */
httpServer.on('request', (req, res) => {
  if (req.url === '/health') {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      connections: {
        total: totalConnections,
        drivers: driverConnections,
        fleet: fleetConnections,
      },
      environment: NODE_ENV,
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
  } else if (req.url === '/ready') {
    // Readiness probe
    checkRedisHealth().then((redisHealthy) => {
      if (redisHealthy) {
        res.writeHead(200);
        res.end('OK');
      } else {
        res.writeHead(503);
        res.end('Redis not ready');
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

/**
 * Graceful Shutdown Handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  
  // Close HTTP server (stop accepting new connections)
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
  });
  
  // Close Socket.io server
  io.close(() => {
    console.log('[Server] Socket.io server closed');
  });
  
  // Close all connections
  const sockets = await io.fetchSockets();
  sockets.forEach((socket) => {
    socket.disconnect(true);
  });
  
  // Close Redis connections
  await closeRedisConnections();
  
  // Close database pool
  await closeDatabasePool();
  
  console.log('[Server] Graceful shutdown complete');
  process.exit(0);
}

// Process event handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason);
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     Fleet Management WebSocket Server                    ║
╠══════════════════════════════════════════════════════════╣
║  Port:        ${PORT.toString().padEnd(48)}║
║  Environment: ${NODE_ENV.padEnd(48)}║
║  Max Conn:    ${WS_MAX_CONNECTIONS.toString().padEnd(48)}║
╚══════════════════════════════════════════════════════════╝
  `);
});

// Export for testing
export { io, httpServer };
