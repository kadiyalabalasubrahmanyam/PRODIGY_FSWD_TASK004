import React, { useState } from 'react';
import { User, Key, UserPlus, LogIn, MessageSquare, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginFormProps {
  onAuthSuccess: (user: { id: string; username: string; displayName: string; avatarColor: string; isOnline: boolean }) => void;
}

export default function LoginForm({ onAuthSuccess }: LoginFormProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all credentials fields');
      return;
    }

    if (isSignUp && !displayName.trim()) {
      setError('Please provide your full Display Name');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
      const payload = isSignUp 
        ? { username: username.trim(), password, displayName: displayName.trim() }
        : { username: username.trim(), password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Identity validation failed. Please check credentials.');
      }

      // Success
      onAuthSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Server did not respond. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Dynamic light gradient overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.05),transparent_40%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(16,185,129,0.04),transparent_40%)]" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8 z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20 mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 mb-1.5">
            {isSignUp ? 'Create Workspace Account' : 'Sign in to Workspace'}
          </h2>
          <p className="text-slate-500 text-sm text-center">
            {isSignUp 
              ? 'Join our developer and designer realtime collaboration board.' 
              : 'Enter your credentials to connect with peers in design circles.'}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-start gap-2.5"
          >
            <ShieldAlert className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-500" />
            <p className="font-medium">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="developer_jane"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
          </div>

          {isSignUp && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="space-y-4 overflow-hidden"
            >
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Display name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <UserPlus className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                    required={isSignUp}
                  />
                </div>
              </div>
            </motion.div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Secret Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Key className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg py-2.5 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/10 disabled:outline-none disabled:bg-indigo-400 disabled:text-indigo-200 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : isSignUp ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Register Workspace Profile</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In Securely</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-indigo-600 hover:text-indigo-500 text-xs font-medium cursor-pointer transition-colors"
          >
            {isSignUp ? 'Already registered? Sign In' : 'Need an authorization profile? Sign Up'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
