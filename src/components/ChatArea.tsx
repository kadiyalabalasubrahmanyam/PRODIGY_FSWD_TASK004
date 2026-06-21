import React, { useState, useRef, useEffect } from 'react';
import { User, Message, MessageFile } from '../types.js';
import { 
  Send, Paperclip, Smile, Image, FileText, X, Search, 
  Download, Image as ImageIcon, SmilePlus, Sparkles, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatAreaProps {
  currentUser: User;
  activeRoomId: string | null;
  activeRoomName: string;
  activeRoomDescription: string;
  isPrivateRoom: boolean;
  messages: Message[];
  typingUsers: { [userId: string]: string }; // userId -> displayName
  onlineUsers: { [userId: string]: User };
  onSocketSend: (type: string, data: any) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '👏', '🚀', '✨'];

export default function ChatArea({
  currentUser,
  activeRoomId,
  activeRoomName,
  activeRoomDescription,
  isPrivateRoom,
  messages = [],
  typingUsers = {},
  onlineUsers = {},
  onSocketSend
}: ChatAreaProps) {
  const [inputText, setInputText] = useState('');
  const [pendingFile, setPendingFile] = useState<MessageFile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Scroll message thread to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  // Handle typing indicator signals
  const transmitTypingStatus = (isTyping: boolean) => {
    if (!activeRoomId) return;
    if (isTypingRef.current !== isTyping) {
      isTypingRef.current = isTyping;
      onSocketSend('typing:status', { roomId: activeRoomId, isTyping });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    transmitTypingStatus(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      transmitTypingStatus(false);
    }, 2000);
  };

  // Process files
  const handleFileLoad = (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      alert("File size exceeds 8MB storage limit. Please optimize image or file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPendingFile({
        url: reader.result as string, // base64 payload
        name: file.name,
        type: file.type,
        size: file.size
      });
    };
    reader.readAsDataURL(file);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileLoad(file);
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileLoad(file);
  };

  // Send message
  const handleSendMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoomId) return;
    if (!inputText.trim() && !pendingFile) return;

    transmitTypingStatus(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    onSocketSend('message:send', {
      roomId: activeRoomId,
      text: inputText,
      file: pendingFile || undefined
    });

    setInputText('');
    setPendingFile(null);
  };

  const appendEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setIsEmojiPickerOpen(false);
  };

  // Formatting helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Filter messages based on search query
  const filteredMessages = messages.filter(m => 
    m.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.file?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // List of active typing users in this chamber
  const typingList = Object.entries(typingUsers)
    .filter(([userId, _]) => userId !== currentUser.id)
    .map(([_, name]) => name);

  return (
    <div 
      className="flex-1 flex h-full bg-white font-sans relative text-slate-800 select-none overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-indigo-600/10 backdrop-blur-xs border-2 border-dashed border-indigo-400 z-50 flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center animate-bounce shadow">
                <Paperclip className="w-6 h-6 text-white" />
              </div>
              <p className="text-slate-800 font-bold text-sm">Drop file here to upload</p>
              <p className="text-slate-400 text-xs">Maximum size limit is 8MB</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main chat column */}
      <div className="flex-1 flex flex-col h-full bg-white relative min-w-0">
        
        {/* activeRoomId Empty Guard */}
        {!activeRoomId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50">
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-md max-w-sm flex flex-col items-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%__50%,rgba(99,102,241,0.03),transparent_60%)]" />
              <div className="p-3.5 bg-indigo-500 rounded-2xl text-white mb-4 shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1.5">Welcome to Communications Workspace</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Choose a channel from rooms listing or select coworker direct messages to initiate elegant real-time collaboration.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Top Room Header */}
            <div className="h-[72px] px-8 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 truncate">
                    {isPrivateRoom ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    ) : (
                      <span className="text-slate-400 select-none">#</span>
                    )}
                    {activeRoomName}
                  </h2>
                </div>
                <p className="text-xs text-slate-400 font-medium truncate mt-0.5">{activeRoomDescription}</p>
              </div>

              {/* Chat Area Searches */}
              <div className="relative shrink-0 w-44 md:w-56 hidden sm:block">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Messages Timeline Thread */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              {filteredMessages.map((msg) => {
                const isMe = msg.senderId === currentUser.id;
                
                // format timestamp
                const matchesDate = new Date(msg.createdAt);
                const formattedTime = matchesDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // file formats
                const isFileImage = msg.file?.type.startsWith('image/');

                return (
                  <div 
                    key={msg.id} 
                    className={`flex items-start gap-4 max-w-full ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Sender Avatar */}
                    <div className={`w-10 h-10 rounded-xl shrink-0 text-white font-bold flex items-center justify-center text-xs shadow-sm bg-gradient-to-tr ${msg.senderAvatarColor || 'from-slate-400 to-slate-500'}`}>
                      {msg.senderName.charAt(0).toUpperCase()}
                    </div>

                    {/* Bubble content wrapper */}
                    <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-baseline gap-2 mb-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs font-bold text-slate-800">{msg.senderName}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-medium">{formattedTime}</span>
                      </div>

                      {/* Chat Bubble Body conforming to Geometric Balance styling */}
                      <div className={`p-3 text-sm leading-relaxed ${
                        isMe 
                          ? 'bg-indigo-600 text-white rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl shadow-sm' 
                          : 'bg-slate-100 text-slate-700 rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'
                      }`}>
                        {msg.text && (
                          <p className="whitespace-pre-wrap select-text break-words">{msg.text}</p>
                        )}

                        {/* Display attachments if present, formatted beautifully as bento block previews */}
                        {msg.file && (
                          <div className="mt-2.5">
                            {isFileImage ? (
                              <a 
                                href={msg.file.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="block rounded-xl overflow-hidden border border-slate-200/60 bg-slate-50 hover:opacity-95 transition-opacity relative group/img cursor-pointer max-w-sm"
                              >
                                <img 
                                  src={msg.file.url} 
                                  alt={msg.file.name} 
                                  referrerPolicy="no-referrer"
                                  className="max-h-52 object-contain w-full rounded-md" 
                                />
                              </a>
                            ) : (
                              <div className={`flex items-center gap-3 p-2 rounded-lg border max-w-sm text-left truncate ${
                                isMe 
                                  ? 'bg-indigo-700/80 border-indigo-500/30 text-white' 
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}>
                                <FileText className={`w-8 h-8 shrink-0 ${isMe ? 'text-indigo-200' : 'text-indigo-500'}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold truncate">{msg.file.name}</p>
                                  <p className={`text-[9px] font-medium ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>{formatBytes(msg.file.size)}</p>
                                </div>
                                <a 
                                  href={msg.file.url} 
                                  download={msg.file.name}
                                  className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                                    isMe 
                                      ? 'bg-indigo-800 border-indigo-700 text-white hover:bg-white hover:text-indigo-600' 
                                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-100'
                                  }`}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {filteredMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400 text-xs italic">
                  {searchTerm ? "No search results match your message keywords." : "No communications found yet. Begin conversation thread."}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing indicators */}
            <div className="h-6 px-8 text-[11px] text-slate-400 select-none flex items-center gap-1.5 font-medium bg-white shrink-0">
              {typingList.length > 0 && (
                <>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                  <span>
                    {typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing...
                  </span>
                </>
              )}
            </div>

            {/* Bottom Chat Input Form Bar - height matches ~96px conforming to Geometric Balance */}
            <div className="p-6 border-t border-slate-100 shrink-0 bg-white">
              
              {/* Optional Quick Emojis bar */}
              <div className="flex gap-1.5 mb-3 px-1 select-none overflow-x-auto scrollbar-none">
                {QUICK_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => appendEmoji(emoji)}
                    className="w-7 h-7 flex items-center justify-center text-sm rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 transition-all cursor-pointer text-slate-600 scale-95 active:scale-90"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {pendingFile && (
                <div className="mb-3 p-2 rounded-xl bg-slate-50 border border-slate-200/80 max-w-sm flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 truncate">
                    {pendingFile.type.startsWith('image/') ? (
                      <img 
                        src={pendingFile.url} 
                        alt="Thumbnail" 
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" 
                      />
                    ) : (
                      <FileText className="w-6 h-6 text-indigo-500 shrink-0" />
                    )}
                    <div className="truncate text-left">
                      <p className="font-bold text-slate-700 truncate">{pendingFile.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{formatBytes(pendingFile.size)}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPendingFile(null)}
                    className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0 border border-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSendMessageSubmit} className="flex gap-4">
                {/* File Attachment toggle */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer shadow-2xs shrink-0 flex items-center justify-center h-11 w-11"
                  title="Attach file (max 8MB)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={onFileInputChange}
                />

                {/* Main text message slot */}
                <input
                  type="text"
                  required={!pendingFile}
                  placeholder={`Type a message to ${isPrivateRoom ? activeRoomName : '#' + activeRoomName}...`}
                  value={inputText}
                  onChange={handleInputChange}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all h-11 shadow-2xs"
                  maxLength={4000}
                />

                {/* Form submit dispatch */}
                <button
                  type="submit"
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors cursor-pointer shadow-lg shadow-indigo-600/15 flex items-center justify-center h-11 w-11 shrink-0"
                >
                  <Send className="w-4.5 h-4.5" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* 3. Room Details Sidebar (Right-side Panel from Geometric Balance specification) */}
      {activeRoomId && (
        <aside className="w-[230px] h-full bg-slate-50 border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto hidden lg:flex">
          
          <div className="h-[72px] px-6 border-b border-slate-200/80 flex items-center shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Room Details</span>
          </div>

          <div className="p-5 flex flex-col gap-6">
            
            {/* Active Members Status section */}
            <section>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Active Now</h4>
              <div className="flex flex-col gap-2">
                
                {/* Me user indicator */}
                <div className="flex items-center gap-3 p-1 rounded-md">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-700 shrink-0">
                    {currentUser.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-700 truncate">{currentUser.displayName} (You)</p>
                    <p className="text-[9px] text-emerald-600 font-bold uppercase">Online</p>
                  </div>
                </div>

                {/* Workspaces direct or group coworkers map info */}
                {Object.values(onlineUsers)
                  .filter(u => u.id !== currentUser.id)
                  .map(user => {
                    const isUserOnline = user.isOnline;
                    return (
                      <div key={user.id} className="flex items-center gap-3 p-1 rounded-md">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 bg-gradient-to-tr ${user.avatarColor || 'from-slate-400 to-slate-500'}`}>
                          {user.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-700 truncate">{user.displayName}</p>
                          <p className={`text-[9px] font-bold uppercase ${isUserOnline ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {isUserOnline ? 'Online' : 'Offline'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>

            {/* Dynamic Shared files lists map from actual message logs within the channel */}
            <section>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Shared Files</h4>
              <div className="flex flex-col gap-2">
                {messages.filter(m => m.file).length > 0 ? (
                  messages.filter(m => m.file).slice(-5).map((msg, i) => {
                    const fileObj = msg.file!;
                    const isImg = fileObj.type.startsWith('image/');
                    return (
                      <a
                        key={i}
                        href={fileObj.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-white rounded-lg border border-slate-200 text-[10px] font-medium text-slate-600 flex items-center gap-2 hover:bg-slate-100 hover:text-indigo-600 truncate transition-colors cursor-pointer"
                        title={fileObj.name}
                      >
                        <span className="shrink-0">{isImg ? '🖼️' : '📄'}</span>
                        <span className="truncate flex-1 text-left">{fileObj.name}</span>
                      </a>
                    );
                  })
                ) : (
                  <p className="text-[10px] text-slate-400 italic px-1">No files shared yet in this thread.</p>
                )}
              </div>
            </section>

          </div>
        </aside>
      )}
    </div>
  );
}
