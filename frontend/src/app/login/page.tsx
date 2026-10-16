'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  UserCheck,
  Check,
  Store,
  Eye,
  EyeOff,
  Lock,
  User,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('Store Operations Lead');
  const [email, setEmail] = useState('manager@retailops.local');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');
    try {
      const res = await api.devLogin(name, email);
      if (res.token) {
        localStorage.setItem('queueiq_token', res.token);
        localStorage.setItem('queueiq_user_name', name);
        localStorage.setItem('queueiq_auth_provider', 'Enterprise Session');
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 700);
      }
    } catch (err) {
      setError('Unable to connect to the backend. Make sure the server is running.');
      console.error('Login error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickAccess = () => {
    localStorage.setItem('queueiq_user_name', 'Store Manager');
    localStorage.setItem('queueiq_auth_provider', 'Local Session');
    setSuccess(true);
    setTimeout(() => router.push('/'), 500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center shadow-glow">
            <Store className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-3xl text-white tracking-tight">
              Queue<span className="text-accent">IQ</span> AI
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Intelligent Supermarket Queue Monitoring System
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-surface-card border border-border rounded-2xl p-7 space-y-5 shadow-retail">
          <div className="space-y-1">
            <h2 className="font-heading font-bold text-xl text-white">
              Operations Sign In
            </h2>
            <p className="text-xs text-slate-400">
              Enter your store credentials to access the dashboard.
            </p>
          </div>

          {/* Quick Access Banner */}
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs">
              <Zap className="w-3.5 h-3.5 text-accent" />
              <span className="text-slate-300">
                Demo mode — click <strong className="text-white">Quick Access</strong> to skip login
              </span>
            </div>
            <button
              onClick={handleQuickAccess}
              className="text-xs font-semibold text-accent hover:text-accent-light transition-colors shrink-0 ml-3"
            >
              Quick Access →
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLocalLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Manager Name</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Store Operations Lead"
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 font-sans transition-all placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Work Email</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@retailops.local"
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 font-mono text-xs transition-all placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Password <span className="text-slate-500">(optional for local)</span></span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all pr-12 placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-danger bg-danger/10 border border-danger/25 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn || success}
              className="w-full py-3.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-light transition-all shadow-glow flex items-center justify-center space-x-2 disabled:opacity-70"
            >
              {success ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Signed In! Loading Dashboard...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>{isLoggingIn ? 'Verifying...' : 'Sign In to Operations Center'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Note */}
        <div className="flex items-center justify-center space-x-2 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-success" />
          <span>All data processed locally — no cloud uploads, no tracking</span>
        </div>
      </div>
    </div>
  );
}
