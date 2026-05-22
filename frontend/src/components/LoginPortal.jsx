import React, { useState } from 'react';
import { auth } from '../config/firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { LogIn, ShieldAlert } from 'lucide-react';

export default function LoginPortal({ onLoginSuccess }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        onLoginSuccess && onLoginSuccess(result.user, false);
      }
    } catch (err) {
      console.error('[AURA LOGIN] Firebase Auth failed:', err);
      let friendlyMessage = 'Google Sign-In failed or was interrupted.';
      
      if (err.code === 'auth/operation-not-allowed') {
        friendlyMessage = 'Google Sign-In is DISABLED in your Firebase Console. Enable the "Google" provider.';
      } else if (err.code === 'auth/unauthorized-domain') {
        friendlyMessage = `Domain (${window.location.hostname}) not authorized. Add it in Firebase Auth settings.`;
      } else if (err.code === 'auth/popup-blocked') {
        friendlyMessage = 'Popup blocked. Allow popups for this site.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        friendlyMessage = 'Popup closed before login. Try again.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        friendlyMessage = 'Popup request cancelled. Try again.';
      } else if (err.code === 'auth/network-request-failed') {
        friendlyMessage = 'Network error. Check your connection.';
      } else {
        friendlyMessage = `Firebase error (${err.code || 'unknown'}): ${err.message || 'Connection refused.'}`;
      }
      
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        onLoginSuccess && onLoginSuccess(userCredential.user, false);
      }
    } catch (err) {
      console.error('[AURA EMAIL LOGIN] Failed:', err);
      let friendlyMessage = 'Email sign‑in failed.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        friendlyMessage = 'No account found with this email or invalid credentials.';
      } else if (err.code === 'auth/wrong-password') {
        friendlyMessage = 'Incorrect password.';
      } else if (err.code === 'auth/invalid-email') {
        friendlyMessage = 'Invalid email address.';
      } else {
        friendlyMessage = `Firebase error (${err.code || 'unknown'}): ${err.message || ''}`;
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-aura-card border-2 border-aura-ink p-8 md:p-12 rounded-none shadow-brutal w-full max-w-md mx-auto space-y-6 text-center select-text">
      <div className="space-y-2">
        <h3 className="font-serif text-3xl font-bold text-aura-ink">Sign In or Create Account</h3>
        <p className="font-sans text-xs text-aura-ink/65 uppercase tracking-widest font-mono">Project AURA :: Citizen Gateway</p>
      </div>

      {error && (
        <div className="bg-aura-sos/10 border border-aura-sos text-aura-sos text-[10px] py-2.5 px-3 rounded-none font-mono flex items-start gap-2 text-left leading-tight">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="pt-4 space-y-4">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-4 px-6 bg-aura-hero text-white border border-aura-ink rounded-full text-base font-sans font-bold hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
        >
          <LogIn className="w-5 h-5" />
          {loading ? 'Connecting Auth...' : 'Continue with Google'}
        </button>

        <div className="relative flex py-2 items-center justify-center">
          <div className="flex-grow border-t border-aura-ink/10"></div>
          <span className="flex-shrink mx-4 text-[10px] font-mono text-aura-ink/40 uppercase tracking-wider">or sign in with email</span>
          <div className="flex-grow border-t border-aura-ink/10"></div>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-3 text-left">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-3 border border-aura-ink bg-white text-aura-ink rounded-none focus:outline-none focus:ring-2 focus:ring-aura-hero"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-3 border border-aura-ink bg-white text-aura-ink rounded-none focus:outline-none focus:ring-2 focus:ring-aura-hero"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 bg-white text-black border border-aura-ink rounded-full text-sm font-mono font-bold uppercase hover:bg-gray-50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            Sign In / Register
          </button>
        </form>
      </div>
    </div>
  );
}
