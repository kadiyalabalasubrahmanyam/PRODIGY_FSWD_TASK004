export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  isOnline: boolean;
  lastSeen?: string;
}

export interface MessageFile {
  url: string; // Dynamic Data URL (base64) or static serving path
  name: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  roomId: string; // can be a public chamber ID or a direct-message room ID
  senderId: string;
  senderName: string;
  senderAvatarColor: string;
  text: string;
  file?: MessageFile;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  participants?: string[]; // user IDs for private group/DM chats
  lastMessage?: Message;
}

export interface TypingIndicator {
  roomId: string;
  userId: string;
  displayName: string;
}

export interface ChatState {
  currentUser: User | null;
  rooms: Room[];
  activeRoomId: string | null;
  messages: { [roomId: string]: Message[] };
  onlineUsers: { [userId: string]: User };
  typingUsers: { [roomId: string]: { [userId: string]: string } }; // roomId -> { userId: displayName }
}
