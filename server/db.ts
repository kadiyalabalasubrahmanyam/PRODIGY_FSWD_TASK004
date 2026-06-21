import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User, Message, Room } from '../src/types'; // Note: tsx resolved relative path imports cleanly

const DB_FILE = path.join(process.cwd(), 'chat_db.json');

interface StoredUser extends User {
  passwordHash: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  rooms: Room[];
  messages: Message[];
}

const DEFAULT_ROOMS: Room[] = [
  { id: 'lobby', name: 'General Lobby', description: 'Main public square for general conversations.', isPrivate: false },
  { id: 'tech', name: 'Tech & Design', description: 'Where developers and designers meet to share visual ideas.', isPrivate: false },
  { id: 'random', name: 'Random & Memes', description: 'Jokes, off-topic chats, and fun media.', isPrivate: false },
  { id: 'collab', name: 'Creative Collab', description: 'Brainstorm workspace for team brainstorming.', isPrivate: false }
];

class Database {
  private data: DatabaseSchema = { users: [], rooms: [...DEFAULT_ROOMS], messages: [] };

  constructor() {
    this.load();
  }

  // Load from disk
  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {
          users: parsed.users || [],
          rooms: parsed.rooms || [...DEFAULT_ROOMS],
          messages: parsed.messages || []
        };
        
        // Ensure default rooms are always present
        for (const defaultRoom of DEFAULT_ROOMS) {
          if (!this.data.rooms.some(r => r.id === defaultRoom.id)) {
            this.data.rooms.unshift(defaultRoom);
          }
        }
      } else {
        this.save();
      }
    } catch (e) {
      console.error('Error loading chat database, starting fresh:', e);
      this.save();
    }
  }

  // Save to disk
  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save chat database:', e);
    }
  }

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // Register user
  public register(username: string, passwordHashRaw: string, displayName: string): { success: boolean; user?: User; error?: string } {
    const normUsername = username.trim().toLowerCase();
    if (!normUsername || !passwordHashRaw || !displayName.trim()) {
      return { success: false, error: 'Username, display name and password are required.' };
    }

    if (this.data.users.some(u => u.username.toLowerCase() === normUsername)) {
      return { success: false, error: 'Username already taken.' };
    }

    // Assign a beautiful random clean avatar color gradient
    const colors = [
      'from-rose-500 to-red-600',
      'from-orange-500 to-amber-600',
      'from-green-500 to-emerald-600',
      'from-teal-500 to-cyan-600',
      'from-blue-500 to-indigo-600',
      'from-violet-500 to-purple-600',
      'from-fuchsia-500 to-pink-600'
    ];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      username: username.trim(),
      displayName: displayName.trim(),
      avatarColor,
      isOnline: false,
      passwordHash: this.hashPassword(passwordHashRaw)
    };

    this.data.users.push(newUser);
    this.save();

    const { passwordHash, ...safeUser } = newUser;
    return { success: true, user: safeUser };
  }

  // Login user
  public login(username: string, passwordHashRaw: string): { success: boolean; user?: User; error?: string } {
    const normUsername = username.trim().toLowerCase();
    const hash = this.hashPassword(passwordHashRaw);

    const user = this.data.users.find(u => u.username.toLowerCase() === normUsername && u.passwordHash === hash);
    if (!user) {
      return { success: false, error: 'Invalid username or password.' };
    }

    const { passwordHash, ...safeUser } = user;
    return { success: true, user: safeUser };
  }

  // Get safe active user profiles
  public getUsers(): User[] {
    return this.data.users.map(({ passwordHash, ...user }) => user);
  }

  public setOnlineStatus(userId: string, isOnline: boolean) {
    const user = this.data.users.find(u => u.id === userId);
    if (user) {
      user.isOnline = isOnline;
      user.lastSeen = new Date().toISOString();
      this.save();
    }
  }

  // Get rooms available for a user (public + private where user is participant)
  public getRoomsForUser(userId: string): Room[] {
    return this.data.rooms.filter(room => {
      if (!room.isPrivate) return true;
      return room.participants?.includes(userId);
    }).map(room => {
      // populate lastMessage
      const roomMsgs = this.data.messages.filter(m => m.roomId === room.id);
      const lastMsg = roomMsgs.length > 0 ? roomMsgs[roomMsgs.length - 1] : undefined;
      return {
        ...room,
        lastMessage: lastMsg
      };
    });
  }

  // Create workspace room / channel
  public createRoom(name: string, description: string, isPrivate: boolean, participants?: string[]): Room {
    const newRoom: Room = {
      id: isPrivate ? `private_${crypto.randomUUID()}` : `room_${crypto.randomUUID()}`,
      name: name.trim(),
      description: description.trim(),
      isPrivate,
      participants: participants || []
    };
    this.data.rooms.push(newRoom);
    this.save();
    return newRoom;
  }

  // Find or create private individual Direct Message room
  public getOrCreateDirectMessageRoom(userAId: string, userBId: string): Room {
    const sortedIds = [userAId, userBId].sort();
    const directRoomId = `dm_${sortedIds[0]}_${sortedIds[1]}`;

    let room = this.data.rooms.find(r => r.id === directRoomId);
    if (!room) {
      const userA = this.data.users.find(u => u.id === userAId);
      const userB = this.data.users.find(u => u.id === userBId);
      
      room = {
        id: directRoomId,
        name: `${userA?.displayName || 'User'} & ${userB?.displayName || 'User'}`,
        description: `Direct conversation between ${userA?.displayName} and ${userB?.displayName}`,
        isPrivate: true,
        participants: sortedIds
      };
      this.data.rooms.push(room);
      this.save();
    }
    return room;
  }

  // Save conversation message
  public addMessage(roomId: string, senderId: string, text: string, file?: { url: string; name: string; type: string; size: number }): Message {
    const sender = this.data.users.find(u => u.id === senderId);
    
    const newMessage: Message = {
      id: crypto.randomUUID(),
      roomId,
      senderId,
      senderName: sender?.displayName || 'Unknown User',
      senderAvatarColor: sender?.avatarColor || 'from-gray-500 to-slate-600',
      text: text,
      file,
      createdAt: new Date().toISOString()
    };

    this.data.messages.push(newMessage);
    this.save();
    return newMessage;
  }

  // Fetch message records for channel
  public getMessageHistory(roomId: string, limit: number = 100): Message[] {
    const filtered = this.data.messages.filter(m => m.roomId === roomId);
    return filtered.slice(-limit);
  }
}

export const dbInstance = new Database();
