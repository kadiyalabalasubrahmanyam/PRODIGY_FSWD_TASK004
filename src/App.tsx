import React, { useState, useEffect, useRef } from 'react';
import { User, Room, Message, ChatState } from './types';
import LoginForm from './components/LoginForm';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import { MessageSquare, RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Synthesize dynamic chime notifications with oscillator node to bypass static media file requirements elegantly
const playNotificationChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    // Arpeggiated high chime: E5 (659.25Hz) followed by A5 (880Hz)
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime);
    osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (err) {
    console.warn('Audio synthesis blocked by browser security policy:', err);
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ws_chat_session_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ [roomId: string]: Message[] }>({});
  const [onlineUsers, setOnlineUsers] = useState<{ [userId: string]: User }>({});
  const [typingUsers, setTypingUsers] = useState<{ [roomId: string]: { [userId: string]: string } }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Read active room details
  const activeRoom = rooms.find(r => r.id === activeRoomId) || null;
  const activeRoomName = activeRoom 
    ? (activeRoom.isPrivate && activeRoom.participants && activeRoom.participants.length === 2
        ? activeRoom.name.split('&').map(n => n.trim()).find(n => n !== currentUser?.displayName) || activeRoom.name
        : activeRoom.name)
    : '';

  const activeRoomDescription = activeRoom?.description || '';
  const isPrivateRoom = activeRoom?.isPrivate || false;

  const handleAuthSuccess = (user: User) => {
    localStorage.setItem('ws_chat_session_v1', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    // Notify server of disconnection first if socket active
    if (socketRef.current) {
      socketRef.current.close();
    }
    localStorage.removeItem('ws_chat_session_v1');
    setCurrentUser(null);
    setRooms([]);
    setActiveRoomId(null);
    setMessages({});
    setOnlineUsers({});
    setTypingUsers({});
    setIsConnected(false);
  };

  // Setup/maintain WebSocket subscription
  const connectWebSocket = () => {
    if (!currentUser) return;

    if (socketRef.current) {
      socketRef.current.close();
    }

    // derive socket protocol based on host environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const socketUrl = `${protocol}//${host}/?userId=${currentUser.id}`;

    console.log(`Configuring socket channel path to: ${socketUrl}`);
    const ws = new WebSocket(socketUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('Instant WebSocket communication established.');
      setIsConnected(true);
      setReconnectAttempt(0);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };

    ws.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);

        switch (type) {
          case 'bootstrap': {
            const { rooms: rList, users: uList } = data;
            setRooms(rList);
            
            // Map users to lookup structure
            const usersLookup: { [key: string]: User } = {};
            uList.forEach((u: User) => {
              usersLookup[u.id] = u;
            });
            setOnlineUsers(usersLookup);

            // Default selection to General Lobby or first room if nothing set
            if (rList.length > 0 && !activeRoomId) {
              const lobbyRoom = rList.find((r: Room) => r.id === 'lobby');
              const targetSelectId = lobbyRoom ? lobbyRoom.id : rList[0].id;
              setActiveRoomId(targetSelectId);
              ws.send(JSON.stringify({ type: 'room:join', data: { roomId: targetSelectId } }));
            }
            break;
          }

          case 'rooms:update': {
            setRooms(data);
            break;
          }

          case 'users:update': {
            const usersLookup: { [key: string]: User } = {};
            data.forEach((u: User) => {
              usersLookup[u.id] = u;
            });
            setOnlineUsers(usersLookup);
            break;
          }

          case 'message:history': {
            const { roomId, messages: msgs } = data;
            setMessages(prev => ({
              ...prev,
              [roomId]: msgs
            }));
            break;
          }

          case 'message:new': {
            const newMsg = data as Message;
            setMessages(prev => {
              const prevMsgs = prev[newMsg.roomId] || [];
              // Prevent duplicates (idempotent guard)
              if (prevMsgs.some(m => m.id === newMsg.id)) {
                return prev;
              }
              return {
                ...prev,
                [newMsg.roomId]: [...prevMsgs, newMsg]
              };
            });

            // Trigger audio notify chime if message is received in another room (not active)
            if (newMsg.senderId !== currentUser.id) {
              if (activeRoomId !== newMsg.roomId || document.hidden) {
                playNotificationChime();
              }
            }
            break;
          }

          case 'typing:update': {
            const { roomId, userId, displayName, isTyping } = data;
            setTypingUsers(prev => {
              const roomTyping = { ...(prev[roomId] || {}) };
              if (isTyping) {
                roomTyping[userId] = displayName;
              } else {
                delete roomTyping[userId];
              }
              return {
                ...prev,
                [roomId]: roomTyping
              };
            });
            break;
          }

          case 'dm:created': {
            const { roomId } = data;
            setActiveRoomId(roomId);
            ws.send(JSON.stringify({ type: 'room:join', data: { roomId } }));
            break;
          }

          default:
            console.warn('Unhandled socket event incoming:', type);
        }
      } catch (e) {
        console.error('Error handling websocket package context payload:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      socketRef.current = null;
      
      // Auto-reconnect flow
      if (currentUser) {
        const nextTime = Math.min(10000, 1000 * Math.pow(2, reconnectAttempt));
        console.log(`WS shut, retrying in ${nextTime}ms (Attempt #${reconnectAttempt + 1})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempt(prev => prev + 1);
          connectWebSocket();
        }, nextTime);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket connection error:', err);
    };
  };

  useEffect(() => {
    if (currentUser) {
      connectWebSocket();
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [currentUser]);

  // Hook ws send requests
  const handleSocketSend = (type: string, data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, data }));
    } else {
      console.warn('Socket unavailable. Buffering message or dropping payload:', type);
    }
  };

  const selectActiveRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    handleSocketSend('room:join', { roomId });
  };

  // If no auth, render login/signup card
  if (!currentUser) {
    return <LoginForm onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* Workspace Sidebar list (Channels, DMs, Profiles) */}
      <Sidebar
        currentUser={currentUser}
        rooms={rooms}
        activeRoomId={activeRoomId}
        onlineUsers={onlineUsers}
        onSetActiveRoom={selectActiveRoom}
        onLogout={handleLogout}
        onSocketSend={handleSocketSend}
      />

      {/* Main interactive chat zone */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        
        {/* Reconnecting banner indicator if connection goes stale */}
        <AnimatePresence>
          {!isConnected && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-500/10 border-b border-amber-500/20 text-amber-700 font-semibold px-4 py-2 text-xs flex items-center justify-between shadow-xs shrink-0"
            >
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>Socket connection dropped. Reconnecting automatically... (Attempt #{reconnectAttempt + 1})</span>
              </div>
              <button 
                onClick={() => connectWebSocket()}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold tracking-wider uppercase cursor-pointer"
              >
                Reconnect now
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messaging Pane */}
        <ChatArea
          currentUser={currentUser}
          activeRoomId={activeRoomId}
          activeRoomName={activeRoomName}
          activeRoomDescription={activeRoomDescription}
          isPrivateRoom={isPrivateRoom}
          messages={activeRoomId ? (messages[activeRoomId] || []) : []}
          typingUsers={activeRoomId ? (typingUsers[activeRoomId] || {}) : {}}
          onlineUsers={onlineUsers}
          onSocketSend={handleSocketSend}
        />
      </div>
    </div>
  );
}
