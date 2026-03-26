import React from 'react';
import { motion } from 'motion/react';
import { Settings, Shield, Mail, Phone, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface Props {
  loginMode: 'admin' | 'team';
  loginError: string | null;
  showPassword: boolean;
  onTogglePassword: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}

export function LoginView({ loginMode, loginError, showPassword, onTogglePassword, onSubmit, onBack }: Props) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            {loginMode === 'admin' ? <Settings className="w-8 h-8 text-emerald-500" /> : <Shield className="w-8 h-8 text-blue-500" />}
          </div>
          <h2 className="text-3xl font-bold">{loginMode === 'admin' ? 'Admin Login' : 'Team Login'}</h2>
          <p className="text-white/40 mt-2">Enter your credentials to access the portal</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label className="text-xs font-bold text-white/40 uppercase mb-2 flex items-center gap-2">
              {loginMode === 'admin' ? <Mail className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
              {loginMode === 'admin' ? 'Email Address' : 'Mobile Number or Email'}
            </label>
            <input
              name="identifier"
              type="text"
              required
              placeholder={loginMode === 'admin' ? 'admin@example.com' : 'team@example.com'}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-white/40 uppercase mb-2 flex items-center gap-2">
              <Lock className="w-3 h-3" />
              Password
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
              />
              <button type="button" onClick={onTogglePassword} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {loginError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm">
              <AlertCircle className="w-4 h-4" />
              {loginError}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button type="submit" className="w-full py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20">
              Sign In
            </button>
            <button type="button" onClick={onBack} className="w-full py-4 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all border border-white/10">
              Back to Portal
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
