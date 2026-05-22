import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import triageRoutes from './routes/triage.js';
import geospatialRoutes from './routes/geospatial.js';
import hospitalRoutes from './routes/hospitals.js';
import weatherRoutes from './routes/weather.js';
import agentLogRoutes from './routes/agentLog.js';
import chatRoutes from './routes/chat.js';

// Load environmental variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for local testing and PWA client
    methods: ['GET', 'POST']
  }
});

// Configure CORS and standard JSON/URL-encoded parsers
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach Socket.io to the app instance for request-level routing calls
app.set('io', io);
global.ioInstance = io;

// Import db helper for missions query
import { db } from './config/db.js';

// Basic base route for health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    system: 'AURA Cognitive Server',
    agent1: 'Triage Agent - Active',
    agent2: 'Geospatial Agent - Active',
    agent3: 'Logistics Agent - Active',
    timestamp: new Date().toISOString()
  });
});

// GET /api/active-missions for Dashboard Kanban board sync
app.get('/api/active-missions', async (req, res) => {
  try {
    const list = await db.getActiveMissions();
    return res.status(200).json(list);
  } catch (error) {
    console.error('[AURA Server] Error retrieving active missions:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// Mount /api endpoints
app.use('/api', triageRoutes);
app.use('/api', geospatialRoutes);
app.use('/api', hospitalRoutes);
app.use('/api', weatherRoutes);
app.use('/api', agentLogRoutes);
app.use('/api', chatRoutes);

// Socket.io Connection Listener
io.on('connection', (socket) => {
  console.log(`[AURA Socket.io] Client connected: ${socket.id}`);
  
  socket.emit('system-status', {
    status: 'CONNECTED',
    message: 'AURA Cognitive Ledger Socket established successfully.',
    timestamp: new Date().toISOString()
  });

  socket.on('disconnect', () => {
    console.log(`[AURA Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Server Initialization
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('\n========================================================================');
  console.log(`   AURA COGNITIVE SERVER IS RUNNING ON PORT: ${PORT}`);
  console.log(`   HEALTH ENDPOINT: http://localhost:${PORT}/health`);
  console.log(`   WEB-SOS ENDPOINT: http://localhost:${PORT}/api/web-sos`);
  console.log(`   TWILIO WEBHOOK ENDPOINT: http://localhost:${PORT}/api/twilio-webhook`);
  console.log('========================================================================\n');
});
