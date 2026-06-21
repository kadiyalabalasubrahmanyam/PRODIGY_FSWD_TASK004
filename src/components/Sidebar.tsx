import React, { useState } from 'react';
import { Room, User } from '../types.js';
import { Hash, Plus, MessageCircle, LogOut, Users, Search, Lock, X, Check, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  currentUser: User;
  rooms: Room[];
  activeRoomId: string | null;
  onlineUsers: { [userId: string]: User };
  onSetActiveRoom: (roomId: string) => void;
  onLogout: () => void;
  onSocketSend: (type: string, data: any) => void;
}

export default function Sidebar({
  currentUser,
  rooms,
  activeRoomId,
  onlineUsers,
  onSetActiveRoom,
  onLogout,
  onSocketSend
}: SidebarProps) {
  const [roomFilter, setRoomFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);

  // Split rooms into standard public rooms/channels and private chats
  const publicChannels = rooms.filter(r => !r.isPrivate && r.name.toLowerCase().includes(roomFilter.toLowerCase()));
  const directConversations = rooms.filter(r => r.isPrivate);

  // Users listed for DM
  const allWorkspaceUsers = Object.values(onlineUsers)
    .filter(u => u.id !== currentUser.id && u.displayName.toLowerCase().includes(userFilter.toLowerCase()))
    .sort((a, b) => {
      // sort online first, then alphabetical
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

  const handleInitiateDM = (targetUserId: string) => {
    onSocketSend('dm:initiate', { targetUserId });
  };

  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    onSocketSend('room:create', {
      name: newRoomName.trim(),
      description: newRoomDesc.trim(),
      isPrivate: newRoomPrivate,
      participants: selectedInvitees
    });

    // Reset Form
    setNewRoomName('');
    setNewRoomDesc('');
    setNewRoomPrivate(false);
    setSelectedInvitees([]);
    setIsCreatingRoom(false);
  };

  const toggleInvitee = (userId: string) => {
    if (selectedInvitees.includes(userId)) {
      setSelectedInvitees(selectedInvitees.filter(id => id !== userId));
    } else {
      setSelectedInvitees([...selectedInvitees, userId]);
    }
  };

  return (
    <div className="flex h-full select-none font-sans shrink-0">
      {/* 1. Geometric Extreme Left Navigation Rail (Dark contrast slate) */}
      <aside className="w-[80px] h-full bg-slate-900 flex flex-col items-center py-6 justify-between shrink-0">
        <div className="flex flex-col items-center gap-6">
          {/* Logo Brand */}
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-600/30">
            WS
          </div>

          {/* Quick Active marker buttons */}
          <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-400 border border-slate-700 text-base font-bold shadow-xs">
            #
          </div>

          <button
            onClick={() => setIsCreatingRoom(true)}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700/80 hover:text-white text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
            title="Create Channel"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* User Presence & Signout inside Extreme Rail */}
        <div className="flex flex-col items-center gap-5">
          <button
            onClick={onLogout}
            className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/20 hover:bg-red-950/20 flex items-center justify-center transition-all cursor-pointer"
            title="Sign out of workspace"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>

          <div className="w-10 h-10 rounded-full bg-emerald-500 border-2 border-slate-900 relative flex items-center justify-center font-bold text-xs text-white">
            {currentUser.displayName.charAt(0).toUpperCase()}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-300 border-2 border-slate-900 rounded-full"></span>
          </div>
        </div>
      </aside>

      {/* 2. Geometric Secondary Navigation (Light Slate) */}
      <nav className="w-[260px] h-full bg-slate-100 border-r border-slate-200 flex flex-col shrink-0">
        
        {/* Navigation Header */}
        <div className="h-[72px] px-5 flex items-center border-b border-slate-200/80 justify-between">
          <h1 className="text-sm font-bold tracking-tight text-slate-800 uppercase">Communications</h1>
          <button 
            onClick={() => setIsCreatingRoom(true)}
            className="p-1 rounded bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border border-slate-200 shadow-sm"
            title="Create Channel"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable channels & list items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          
          {/* CHANNELS ACCORDION */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2.5 flex items-center justify-between">
              <span>Chat Rooms ({publicChannels.length})</span>
            </div>

            {/* Quick search */}
            <div className="relative mb-3 px-1">
              <Search className="w-3 h-3 text-slate-400 absolute left-3 top-2" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-md py-1.5 pl-8 pr-3 text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors shadow-2xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              {publicChannels.map(room => {
                const isActive = room.id === activeRoomId;
                return (
                  <button
                    key={room.id}
                    onClick={() => onSetActiveRoom(room.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                      isActive 
                        ? 'bg-white shadow-sm border border-slate-200 text-slate-900 font-medium' 
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'
                    }`}
                  >
                    <span className="text-slate-400 font-medium">#</span>
                    <span className="truncate flex-1">{room.name}</span>
                    {room.lastMessage && (
                      <span className="text-[9px] text-slate-400 font-medium shrink-0">
                        {new Date(room.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </button>
                );
              })}
              {publicChannels.length === 0 && (
                <p className="text-[11px] text-slate-400 italic px-3 mt-1">No channels found</p>
              )}
            </div>
          </div>

          {/* COWORKERS & DIRECT MESSAGES */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2.5">
              Direct Messages
            </div>

            {/* User filters */}
            <div className="relative mb-3 px-1">
              <Search className="w-3 h-3 text-slate-400 absolute left-3 top-2" />
              <input
                type="text"
                placeholder="Search search peers..."
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-md py-1.5 pl-8 pr-3 text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors shadow-2xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              {allWorkspaceUsers.map(user => {
                const matchingRooms = directConversations.filter(r => r.participants?.includes(user.id));
                const dmRoom = matchingRooms.length > 0 ? matchingRooms[0] : null;
                const isActive = dmRoom ? dmRoom.id === activeRoomId : false;

                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      if (dmRoom) {
                        onSetActiveRoom(dmRoom.id);
                      } else {
                        handleInitiateDM(user.id);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                      isActive 
                        ? 'bg-white shadow-sm border border-slate-200 text-slate-900 font-medium' 
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      user.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                    }`} />
                    <span className="truncate flex-grow text-slate-600 font-medium">{user.displayName}</span>
                    <span className="text-[9px] text-slate-400">{user.isOnline ? 'Active' : ''}</span>
                  </button>
                );
              })}
              
              {allWorkspaceUsers.length === 0 && (
                <p className="text-[11px] text-slate-400 italic px-3 mt-1">No coworkers found</p>
              )}
            </div>
          </div>

        </div>

        {/* Secondary user identification indicator */}
        <div className="p-3 bg-slate-250/20 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 px-4 shrink-0">
          <div className="truncate pr-2">
            <span className="font-semibold text-slate-700 block truncate">@{currentUser.username}</span>
            <span className="text-[10px] text-slate-400">Authenticated profile</span>
          </div>
          <Activity className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        </div>
      </nav>

      {/* Light Create Channel Modal Overlays with Geometric styling alignment */}
      <AnimatePresence>
        {isCreatingRoom && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 text-slate-800"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-indigo-500" />
                  Create New Workspace Channel
                </h3>
                <button
                  onClick={() => setIsCreatingRoom(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateRoomSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Channel name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. design-assets"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    placeholder="Describe what people will brainstorm in this chamber..."
                    value={newRoomDesc}
                    onChange={(e) => setNewRoomDesc(e.target.value)}
                    className="w-full h-16 bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Make Invite-Only (Private)</span>
                    <span className="text-[10px] text-slate-400">Only selected workspace members can view history</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewRoomPrivate(!newRoomPrivate);
                      if (!newRoomPrivate) {
                        setSelectedInvitees([]);
                      }
                    }}
                    className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${
                      newRoomPrivate ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      newRoomPrivate ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {newRoomPrivate && (
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">
                      Invite Workspace Members
                    </span>
                    <div className="max-h-24 overflow-y-auto space-y-1 bg-slate-50 border border-slate-200 p-2 rounded-lg scrollbar-thin">
                      {Object.values(onlineUsers)
                        .filter(u => u.id !== currentUser.id)
                        .map(user => {
                          const isInvited = selectedInvitees.includes(user.id);
                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => toggleInvitee(user.id)}
                              className="w-full flex items-center justify-between p-1 px-2 rounded-md hover:bg-slate-200/50 text-xs transition-colors cursor-pointer"
                            >
                              <span className="text-slate-600 text-[11px]">{user.displayName}</span>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                isInvited ? 'bg-indigo-600 border-indigo-500' : 'border-slate-300'
                              }`}>
                                {isInvited && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </button>
                          );
                        })}
                      {Object.values(onlineUsers).filter(u => u.id !== currentUser.id).length === 0 && (
                        <p className="text-[10px] text-slate-400 italic">No other workspace users yet</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-3 font-semibold text-xs">
                  <button
                    type="button"
                    onClick={() => setIsCreatingRoom(false)}
                    className="px-4 py-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    Create Channel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
