import React, { useState } from 'react';
import { getGoogleLoginUrl, loginWithEmail, requestPasswordReset, resetPassword, signupWithEmail } from '../api';

interface Props {
  onLogin: (token: string, name: string) => void;
}

export default function LoginForm({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset' | 'signup'>('login');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { user, token } = await loginWithEmail(email, password);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      onLogin(token, user.name);
    } catch {
      setError('Login failed. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email is required.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await requestPasswordReset(email);
      setMessage('If this email is allowed, a reset code was sent.');
      setMode('reset');
    } catch {
      setError('Failed to send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || !newPassword) {
      setError('Reset code and new password are required.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await resetPassword(resetToken, newPassword);
      setMessage('Password reset successful. Please sign in.');
      setMode('login');
      setPassword('');
      setResetToken('');
      setNewPassword('');
    } catch {
      setError('Reset failed. Please check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupPassword) {
      setError('Email and password are required.');
      return;
    }
    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (signupPassword !== signupConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { user, token } = await signupWithEmail(signupEmail, signupPassword, signupName || undefined);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      onLogin(token, user.name);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Sign up failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8f9fa' }}>
      <div className="w-full max-w-sm p-8 rounded-lg shadow-md bg-white">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎓</div>
          <h1 className="text-xl font-bold text-gray-800">Stonepark Intermediate School</h1>
          <p className="text-sm text-gray-500 mt-1">Chromebook Manager</p>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded text-sm" style={{ backgroundColor: '#f8d7da', color: '#dc3545' }}>
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 px-3 py-2 rounded text-sm" style={{ backgroundColor: '#d4edda', color: '#155724' }}>
            {message}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@cloud.edu.pe.ca"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                style={{ borderColor: '#ccc' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                style={{ borderColor: '#ccc' }}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded font-medium text-sm transition-opacity"
              style={{ backgroundColor: '#333333', color: '#fff', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => setMode('forgot')}
              className="w-full text-xs text-gray-500 underline"
            >
              Forgot password?
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@cloud.edu.pe.ca"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                style={{ borderColor: '#ccc' }}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded font-medium text-sm transition-opacity"
              style={{ backgroundColor: '#333333', color: '#fff', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Sending…' : 'Send Reset Code'}
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full text-xs text-gray-500 underline"
            >
              Back to Sign In
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reset Code</label>
              <input
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Paste the reset code"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                style={{ borderColor: '#ccc' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                style={{ borderColor: '#ccc' }}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded font-medium text-sm transition-opacity"
              style={{ backgroundColor: '#333333', color: '#fff', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full text-xs text-gray-500 underline"
            >
              Back to Sign In
            </button>
          </form>
        )}

        <div className="mt-4 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" style={{ borderColor: '#e5e7eb' }} />
          </div>
          <div className="relative flex justify-center text-xs text-gray-500 bg-white px-2">or</div>
        </div>

        <a
          href={getGoogleLoginUrl()}
          className="mt-4 flex items-center justify-center gap-2 w-full py-2 rounded border font-medium text-sm transition-colors hover:bg-gray-50"
          style={{ borderColor: '#ccc', color: '#333' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </a>

        {mode !== 'signup' && (
          <button
            type="button"
            onClick={() => setMode('signup')}
            className="mt-3 w-full py-2 rounded border text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ borderColor: '#333', color: '#333' }}
          >
            Sign Up
          </button>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
              <input
                type="text"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="Your name"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                style={{ borderColor: '#ccc' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="you@cloud.edu.pe.ca"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                style={{ borderColor: '#ccc' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                style={{ borderColor: '#ccc' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={signupConfirm}
                onChange={(e) => setSignupConfirm(e.target.value)}
                placeholder="Repeat password"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                style={{ borderColor: '#ccc' }}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded font-medium text-sm transition-opacity"
              style={{ backgroundColor: '#333333', color: '#fff', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Signing up…' : 'Create Account'}
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full text-xs text-gray-500 underline"
            >
              Back to Sign In
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          Stonepark Intermediate School — Staff Access Only
        </p>
      </div>
    </div>
  );
}
