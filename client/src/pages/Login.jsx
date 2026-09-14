import React, { useState } from 'react';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
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
      onLoginSuccess(data.user, data.tenant);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-darkBg px-4 relative overflow-hidden">
      {/* Background ambient glowing circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-gold/5 blur-[120px] pulse-glow-gold pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-electric/5 blur-[120px] pulse-glow-blue pointer-events-none"></div>

      <div className="w-full max-w-md glass-card p-8 rounded-3xl glow-gold/5 animate-fade-in-up relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div 
            onClick={() => {
              const newTapCount = tapCount + 1;
              setTapCount(newTapCount);
            }}
            className="w-16 h-16 bg-gradient-to-tr from-gold to-gold-light rounded-2xl flex items-center justify-center shadow-lg shadow-gold/20 mb-4 animate-bounce-slow cursor-pointer"
          >
            <Shield className="w-8 h-8 text-darkBg" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">POS LOGIN</h1>
          <p className="text-gray-400 text-sm mt-1">Optical Store Management POS</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Username</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter username (owner/employee)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-4 pr-4 py-3 bg-darkSurface border border-white/5 rounded-xl text-white focus:outline-none focus:border-gold transition-all"
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
                className="w-full pl-4 pr-12 py-3 bg-darkSurface border border-white/5 rounded-xl text-white focus:outline-none focus:border-gold transition-all"
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
            className="w-full bg-gradient-to-r from-gold to-gold-light hover:opacity-90 active:scale-[0.98] text-darkBg font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-gold/10 transition-all flex items-center justify-center space-x-2 text-base mt-2"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-darkBg border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                <span>Secure Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/5 pt-6 space-y-4">
          <p className="text-gray-500 text-xs">
            Demo credentials: <code className="text-gold font-mono">owner</code> / <code className="text-gold font-mono">owner123</code> or <code className="text-gold font-mono">employee</code> / <code className="text-gold font-mono">emp123</code>
          </p>
          {tapCount >= 5 && (
            <button 
              onClick={() => navigate('/super-admin')}
              className="text-gold/80 hover:text-gold text-xs font-medium transition-colors underline-offset-4 hover:underline animate-fade-in-up"
            >
              Access Super Admin Panel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
