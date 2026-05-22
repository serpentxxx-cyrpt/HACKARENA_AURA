import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

export default function LogoutButton({ onLogoutSuccess }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (onLogoutSuccess) {
        onLogoutSuccess();
      }
      navigate('/');
    } catch (err) {
      console.error('[AURA LOGOUT] Error during signOut:', err);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 py-1.5 px-4 bg-white text-black border border-black font-sans text-xs font-bold uppercase hover:bg-gray-100 hover:text-black transition-colors rounded-none cursor-pointer"
      title="Securely exit session"
    >
      <LogOut className="w-4 h-4" />
      <span>Log Out</span>
    </button>
  );
}
