'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, Key, HelpCircle, Check, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('Store Operations Lead');
  const [email, setEmail] = useState('manager@hypermarket.local');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await api.devLogin(name, email);
      if (res.token) {
        localStorage.setItem('queueiq_token', res.token);
        localStorage.setItem('queueiq_user_name', name);
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 1000);
      }
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 p-8 rounded-3xl bg-surface-card border border-border shadow-2xl space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center shadow-glow">
          <ShieldCheck className="w-6 h-6 text-background" />
        </div>
        <h2 className="font-heading font-bold text-2xl text-white">
          Sign In to QueueIQ AI
        </h2>
        <p className="text-xs text-slate-400">
          Local-first authentication for supermarket operations management.
        </p>
      </div>

      {/* Local Dev Login Form */}
      <form onSubmit={handleLocalLogin} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Manager Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-sm text-white focus:outline-none focus:border-primary font-sans"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Work Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-sm text-white focus:outline-none focus:border-primary font-mono text-xs"
          />
        </div>

        <button
          type="submit"
          disabled={isLoggingIn}
          className="w-full py-3 rounded-xl text-xs font-semibold bg-primary text-background hover:bg-primary-light transition-all shadow-glow flex items-center justify-center space-x-2"
        >
          {success ? (
            <>
              <Check className="w-4 h-4" />
              <span>Signed In! Redirecting...</span>
            </>
          ) : (
            <>
              <UserCheck className="w-4 h-4" />
              <span>{isLoggingIn ? 'Authenticating...' : 'Sign In (Local Dev Session)'}</span>
            </>
          )}
        </button>
      </form>

      {/* Google OAuth Documentation Card */}
      <div className="p-4 rounded-xl bg-surface/80 border border-border text-xs text-slate-400 space-y-2">
        <div className="flex items-center space-x-1.5 text-slate-200 font-semibold">
          <Key className="w-3.5 h-3.5 text-accent" />
          <span>Google OAuth Configuration Guide</span>
        </div>
        <p className="leading-relaxed text-[11px]">
          To enable production Google OAuth, configure your free Google Cloud Console OAuth 2.0 Client ID:
        </p>
        <div className="p-2 rounded bg-surface-elevated font-mono text-[10px] text-slate-300 space-y-0.5">
          <div>GOOGLE_CLIENT_ID=&quot;your-id.apps.googleusercontent.com&quot;</div>
          <div>GOOGLE_CLIENT_SECRET=&quot;your-secret&quot;</div>
        </div>
        <p className="text-[10px] text-slate-500">
          The system will safely default to local sessions if external Google credentials are not supplied.
        </p>
      </div>
    </div>
  );
}
