
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
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const emailLower = email.toLowerCase().trim();
      
      // 1. التحقق من جدول user_profiles أولاً (النظام المركزي المحدث)
      const { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', emailLower)
        .maybeSingle();

      if (profile) {
          // التحقق من كلمة المرور المخزنة في الجدول
          if (profile.password === password) {
              const loggedInUser: User = {
                id: profile.id,
                username: emailLower,
                name: profile.full_name,
                role: profile.role as UserRole,
              };
              setUser(loggedInUser);
              localStorage.setItem('currentUser', JSON.stringify(loggedInUser));
              return true;
          } else {
              console.warn("Invalid password for profile");
              return false;
          }
      }

      // 2. المحاولة عبر Supabase Auth (إذا لم يكن المستخدم في الجدول أو نستخدم تسجيل دخول خارجي)
      const { data: authData } = await supabase.auth.signInWithPassword({
        email: emailLower,
        password,
      });

      if (authData?.user) {
        const loggedInUser: User = {
          id: authData.user.id,
          username: emailLower,
          name: authData.user.user_metadata?.full_name || 'المستخدم',
          role: 'cashier', // رتبة افتراضية
        };
        setUser(loggedInUser);
        localStorage.setItem('currentUser', JSON.stringify(loggedInUser));
        return true;
      }

      // 3. Fallback للحسابات التجريبية (إذا فشل كل ما سبق)
      if (password === '123456') {
          let role: UserRole = 'cashier';
          let name = 'موظف تجريبي';
          
          if (emailLower === 'it@mirfad.com') { role = 'it'; name = 'IT Admin'; }
          else if (emailLower === 'ahmed@mirfad.com') { role = 'owner'; name = 'Ahmed (Owner)'; }
          
          const loggedInUser: User = { id: 'fallback-' + Date.now(), username: emailLower, name, role };
          setUser(loggedInUser);
          localStorage.setItem('currentUser', JSON.stringify(loggedInUser));
          return true;
      }

      return false;

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
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
