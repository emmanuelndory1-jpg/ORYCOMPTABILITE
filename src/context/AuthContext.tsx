import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db, logout as firebaseLogout } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { jwtDecode } from 'jwt-decode';

interface User {
  uid: string;
  id?: string | number;
  email: string | null;
  role: string;
  name: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Initialize from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        // Basic check for expiration if exp is present
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem('token');
        } else {
          setUser({
            uid: decoded.uid || decoded.id?.toString() || 'manual-user',
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role || 'user'
          });
        }
      } catch (e) {
        console.error("Failed to decode initial token:", e);
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true);
        try {
          const idToken = await firebaseUser.getIdToken();
          const response = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken,
              email: firebaseUser.email,
              name: firebaseUser.displayName,
              uid: firebaseUser.uid
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.token) {
              localStorage.setItem('token', data.token);
              const decoded: any = jwtDecode(data.token);
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: firebaseUser.displayName,
                role: decoded.role || 'user'
              });
            }
          }
        } catch (error) {
          console.error("Firebase auth sync error:", error);
        } finally {
          setLoading(false);
        }
      } else {
        // If Firebase user is null, only clear if we DID have a firebase user session
        // We can check if the current user uid is a firebase uid pattern or check a flag
        // For simplicity, we only clear if the user is null and there was a firebase session
        // Actually, if firebaseUser is null, it means we ARE NOT signed in with Google.
        // If we are signed in manually, we don't want to clear it.
        
        // Check if current token in storage is likely a Firebase synced one
        const token = localStorage.getItem('token');
        if (token && auth.currentUser === null) {
          try {
             // If we can't find hints it's a manual one, or if we want to be safe:
             // For now, let's just NOT wipe if onAuthStateChanged fires with null
             // unless we specifically know the user just clicked "Logout".
          } catch(e) {}
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    setLoading(true);
    try {
      if (auth.currentUser) {
        await firebaseLogout();
      }
      localStorage.removeItem('token');
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
