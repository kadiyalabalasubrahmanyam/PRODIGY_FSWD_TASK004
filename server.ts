import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { dbInstance } from './server/db';

// Extend WebSocket to hold custom properties
interface CustomWebSocket extends WebSocket {
  userId?: string;
  activeRoomId?: string;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser with 20mb ceiling to support base64 multi-media file structures smoothly
  app.use(express.json({ limit: '20mb' }));

  // REST API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // User registration
  app.post('/api/auth/register', (req, res) => {
    const { username, password, displayName } = req.body;
    const result = dbInstance.register(username, password, displayName);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ user: result.user });
  });

  // User login
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const result = dbInstance.login(username, password);
    if (!result.success) {
      res.status(401).json({ error: result.error });
      return;
    }
    res.json({ user: result.user });
  });

  // Fetch listing of all members
  app.get('/api/users', (req, res) => {
    res.json({ users: dbInstance.getUsers() });
  });

  // Build local HTTP server to wrap both Express and WebSocket upgrades
  const server = http.createServer(app);

  // Initialize WebSockets server
  const wss = new WebSocketServer({ server });

  // Keep a map of active users pointing to set of client web-sockets to manage multi-tab connections
  const userSockets = new Map<string, Set<CustomWebSocket>>();

  // Helper: broadcast an event to users who have permission
  const broadcastEvent = (type: string, payload: any, recipientIds?: string[]) => {
    const eventString = JSON.stringify({ type, data: payload });

    wss.clients.forEach((client: CustomWebSocket) => {
      if (client.readyState === WebSocket.OPEN && client.userId) {
        // If recipient list is provided, restrict to them
        if (recipientIds && !recipientIds.includes(client.userId)) {
          return;
        }
        client.send(eventString);
      }
    });
  };

  const broadcastUsersList = () => {
    const users = dbInstance.getUsers();
    broadcastEvent('users:update', users);
  };

  wss.on('connection', (ws: CustomWebSocket, req) => {
    // Extract userId from query string: e.g. ws://host/?userId=xxxx
    const urlParams = new URL(req.url || '', 'http://identity-dummy.com').searchParams;
    const userId = urlParams.get('userId');

    if (!userId) {
      ws.close(1008, 'Missing userId parameter');
      return;
    }

    ws.userId = userId;

    // Track sockets per user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(ws);

    // Track user presence
    dbInstance.setOnlineStatus(userId, true);
    
    // Send initial bootstrap info to this user
    const initialRooms = dbInstance.getRoomsForUser(userId);
    ws.send(JSON.stringify({
      type: 'bootstrap',
      data: {
        rooms: initialRooms,
        users: dbInstance.getUsers()
      }
    }));

    // Broadcast the presence update to all other connected nodes
    broadcastUsersList();

    // Set heartbeat interval
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('message', (messageString) => {
      try {
        const raw = messageString.toString();
        const { type, data } = JSON.parse(raw);

        switch (type) {
          case 'room:join': {
            const { roomId } = data;
            ws.activeRoomId = roomId;
            // Fetch message timeline
            const history = dbInstance.getMessageHistory(roomId);
            ws.send(JSON.stringify({
              type: 'message:history',
              data: { roomId, messages: history }
            }));
            break;
          }

          case 'message:send': {
            const { roomId, text, file } = data;
            if (!roomId || (!text && !file)) return;

            // Commit to database
            const savedMsg = dbInstance.addMessage(roomId, userId, text, file);

            // Determine recipients (for direct chats, restrict strictly to room participants)
            let recipientIds: string[] | undefined = undefined;
            
            // Check if this room has restricted membership
            const userRooms = dbInstance.getRoomsForUser(userId);
            const targetRoom = userRooms.find(r => r.id === roomId);
            if (targetRoom && targetRoom.isPrivate && targetRoom.participants) {
              recipientIds = targetRoom.participants;
            }

            // Broadcast message back
            broadcastEvent('message:new', savedMsg, recipientIds);
            
            // Send room list updates if a lastMessage has changed
            if (recipientIds) {
              recipientIds.forEach(recipientId => {
                const rList = dbInstance.getRoomsForUser(recipientId);
                broadcastEvent('rooms:update', rList, [recipientId]);
              });
            } else {
              // Public room update
              wss.clients.forEach((client: CustomWebSocket) => {
                if (client.userId) {
                  const rList = dbInstance.getRoomsForUser(client.userId);
                  client.send(JSON.stringify({ type: 'rooms:update', data: rList }));
                }
              });
            }
            break;
          }

          case 'typing:status': {
            const { roomId, isTyping } = data;
            const sender = dbInstance.getUsers().find(u => u.id === userId);
            if (!roomId || !sender) return;

            // Target room's authorized viewers
            let recipientIds: string[] | undefined = undefined;
            const userRooms = dbInstance.getRoomsForUser(userId);
            const targetRoom = userRooms.find(r => r.id === roomId);
            if (targetRoom && targetRoom.isPrivate && targetRoom.participants) {
              recipientIds = targetRoom.participants;
            }

            broadcastEvent('typing:update', {
              roomId,
              userId,
              displayName: sender.displayName,
              isTyping
            }, recipientIds);
            break;
          }

          case 'room:create': {
            const { name, description, isPrivate, participants } = data;
            const parts = isPrivate ? Array.from(new Set([userId, ...(participants || [])])) : [];
            const newRoom = dbInstance.createRoom(name, description, isPrivate, parts);

            // Broadcast room status to matching connections
            if (isPrivate) {
              parts.forEach(pId => {
                const refreshedRooms = dbInstance.getRoomsForUser(pId);
                broadcastEvent('rooms:update', refreshedRooms, [pId]);
              });
            } else {
              // Public Room
              wss.clients.forEach((client: CustomWebSocket) => {
                if (client.userId) {
                  const refreshedRooms = dbInstance.getRoomsForUser(client.userId);
                  client.send(JSON.stringify({ type: 'rooms:update', data: refreshedRooms }));
                }
              });
            }
            break;
          }

          case 'dm:initiate': {
            const { targetUserId } = data;
            if (!targetUserId) return;
            const dmRoom = dbInstance.getOrCreateDirectMessageRoom(userId, targetUserId);

            // Return DM Room details to both users specifically
            const usersToNotify = [userId, targetUserId];
            usersToNotify.forEach(pId => {
              const refreshedRooms = dbInstance.getRoomsForUser(pId);
              broadcastEvent('rooms:update', refreshedRooms, [pId]);
            });

            // Notify initiator showing room selected
            ws.send(JSON.stringify({
              type: 'dm:created',
              data: { roomId: dmRoom.id }
            }));
            break;
          }

          default:
            console.warn('Unknown WebSocket message type received:', type);
        }
      } catch (err) {
        console.error('Error handling WebSocket socket message:', err);
      }
    });

    ws.on('close', () => {
      clearInterval(pingInterval);

      // Clean socket reference
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          // Set user to offline
          dbInstance.setOnlineStatus(userId, false);
          // Broadcast status change
          broadcastUsersList();
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket socket error for user ${userId}:`, err);
    });
  });

  // Mount Vite middleware for development or Serve static directory in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server loaded and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
