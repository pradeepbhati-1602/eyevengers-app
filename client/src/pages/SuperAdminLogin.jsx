import React, { useState } from 'react';
import { ShieldAlert, Lock, Eye, EyeOff } from 'lucide-react';

export default function SuperAdminLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/superadmin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const contentType = res.headers.get('content-type');
      let data = {};
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server responded with status code ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-darkBg px-4 relative overflow-hidden">
      {/* Background ambient glowing circles - Red/Purple for Super Admin */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-red-500/10 blur-[120px] pulse-glow-gold"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-[120px] pulse-glow-blue"></div>

      <div className="w-full max-w-md glass-card p-8 rounded-3xl border border-red-500/20 shadow-2xl shadow-red-500/5 animate-fade-in-up relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-red-600 to-red-400 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30 mb-4">
            <ShieldAlert className="w-8 h-8 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">SAAS ADMIN</h1>
          <p className="text-red-400 text-sm mt-1 font-semibold uppercase tracking-widest">Restricted Access</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Admin Email</label>
            <div className="relative">
              <input
                type="email"
                placeholder="admin@eyevengers.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-4 pr-4 py-3 bg-darkSurface border border-white/5 rounded-xl text-white focus:outline-none focus:border-red-500 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-3 bg-darkSurface border border-white/5 rounded-xl text-white focus:outline-none focus:border-red-500 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              'Authenticate'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
