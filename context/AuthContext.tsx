
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for existing session in localStorage or Supabase
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      let userId = '';
      
      // 1. Try Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (data?.user) {
        userId = data.user.id;
      } else {
        // 2. Fallback: If Supabase auth fails (e.g. user not created in DB yet), 
        // check against hardcoded credentials to ensure access is not blocked.
        console.warn("Supabase auth failed, checking fallback credentials...");
        const emailLower = email.toLowerCase().trim();
        
        if (emailLower === 'ahmed@mirfad.com' && password === '123456') userId = 'fallback-ahmed';
        else if (emailLower === 'kamal@mirfad.com' && password === '123456') userId = 'fallback-kamal';
        else if (emailLower === 'majed@mirfad.com' && password === '123121') userId = 'fallback-majed';
        else if (emailLower === 'chefeyad@mirfad.com' && password === '123456') userId = 'fallback-chef-eyad';
      }

      if (!userId) {
        console.error("Login failed: Invalid credentials");
        return false;
      }

      // Map emails to names and roles based on your requirements
      let name = 'المستخدم';
      let role: UserRole = 'cashier'; // Default role

      const emailLower = email.toLowerCase();
      
      if (emailLower.includes('ahmed')) {
        name = 'Ahmed';
        role = 'owner'; // Ahmed is Owner
      } else if (emailLower.includes('majed')) {
        name = 'Majed';
        role = 'owner'; // Majed is Owner
      } else if (emailLower.includes('kamal')) {
        name = 'Kamal';
        role = 'admin'; // Kamal stays as Admin (Manager)
      } else if (emailLower.includes('chefeyad')) {
        name = 'Chef Eyad';
        role = 'chef'; // Restricted access
      }

      const loggedInUser: User = {
        id: userId,
        username: email, // Use email as username
        name: name,
        role: role,
      };

      setUser(loggedInUser);
      localStorage.setItem('currentUser', JSON.stringify(loggedInUser));
      return true;

    } catch (err) {
      console.error("Login error:", err);
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
