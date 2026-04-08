import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { Lock, Shield, User, LogIn, Mail, Key, UserPlus, ArrowLeft, Settings, ShieldCheck, AlertCircle, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type AuthMode = 'login' | 'register';

interface LoginPageProps {
  onAdminLoginSuccess?: () => void;
}

export default function LoginPage({ onAdminLoginSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState(localStorage.getItem('locker_email') || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminError, setAdminError] = useState('');
  const navigate = useNavigate();

  const handleAdminPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    
    // Simple PIN check
    if (adminPin === '2026') {
      localStorage.setItem('admin_session', 'true');
      if (onAdminLoginSuccess) onAdminLoginSuccess();
      navigate('/admin');
    } else {
      setAdminError('Invalid administrative PIN');
      setAdminPin('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name || !email || !password) throw new Error('All fields are required');
        await authService.registerWithEmail(name, email, password);
      } else {
        if (!email) {
          // If email is missing from localStorage, we need to show the email field
          setMode('register');
          setError('Please register first or enter your email.');
          setLoading(false);
          return;
        }
        await authService.loginWithEmail(email, password);
      }
    } catch (err: any) {
      let message = err.message || 'Authentication failed';
      if (err.code === 'auth/invalid-credential') {
        message = 'Invalid email or password. Please check your credentials and try again.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please login instead.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await authService.loginWithGoogle();
    } catch (err) {
      setError('Google login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md relative"
      >
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-50 rounded-full blur-2xl opacity-50"></div>
        
        <div className="relative z-10">
          <div className="mb-8 flex justify-center">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200">
              <Lock className="w-10 h-10 text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
            {mode === 'login' ? 'Welcome to Lockify' : 'Join Lockify'}
          </h1>
          <p className="text-gray-500 mb-8 text-center text-sm">
            {mode === 'login' 
              ? (email ? `Unlock your vault for ${email}` : 'Access your secure files') 
              : 'Set up your secure file locker'}
          </p>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-red-100"
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div
                  key="register-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Full Name"
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      placeholder="Email Address"
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                placeholder="Vault Password"
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus={mode === 'login'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Processing...' : (mode === 'login' ? 'Unlock Vault' : 'Create Account')}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-blue-600 font-semibold hover:underline"
            >
              {mode === 'login' ? 'New here? Register' : 'Already have a vault? Login'}
            </button>
            {mode === 'login' && email && (
              <button
                onClick={() => {
                  localStorage.removeItem('locker_email');
                  setEmail('');
                  setMode('register');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                Not you?
              </button>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col items-center gap-4 relative">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-600 font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 transition-all"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>

            <div className="w-full flex items-center justify-between px-2">
              <a 
                href="https://wa.me/1234567890"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold text-green-600 hover:text-green-700 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Support
              </a>

              {/* Hidden Admin Access (Very Subtle) */}
              <button
                onClick={() => setShowAdminPinModal(true)}
                className="text-[8px] text-gray-300 hover:text-gray-500 transition-colors cursor-default uppercase tracking-widest opacity-30 hover:opacity-100"
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Admin PIN Modal */}
      <AnimatePresence>
        {showAdminPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600"></div>
              
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-2xl mb-4">
                  <ShieldCheck className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Admin Entry</h3>
                <p className="text-gray-500 text-xs font-medium mt-1">Enter PIN to access console</p>
              </div>

              {adminError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-6 text-xs font-bold flex items-center gap-2 border border-red-100">
                  <AlertCircle className="w-4 h-4" />
                  {adminError}
                </div>
              )}

              <form onSubmit={handleAdminPinSubmit} className="space-y-6">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    className="w-full pl-12 pr-4 py-4 text-center text-2xl tracking-[1em] bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-black"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    autoFocus
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminPinModal(false);
                      setAdminPin('');
                      setAdminError('');
                    }}
                    className="flex-1 px-4 py-3.5 text-gray-500 font-bold text-sm bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3.5 bg-indigo-600 text-white font-black text-sm rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Unlock
                  </button>
                </div>
              </form>
              
              <p className="text-[10px] text-gray-300 text-center mt-8 font-bold uppercase tracking-widest">
                Security Level 4 • 2026
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
