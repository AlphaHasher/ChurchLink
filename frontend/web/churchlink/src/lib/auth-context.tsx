import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getIdTokenResult } from 'firebase/auth';
import { auth, onAuthStateChanged } from './firebase';

// Extend Firebase User to include role
interface AuthUser extends User {
  role?: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  loading: boolean;
  isWhitelisted: boolean;
  role: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook for consuming authentication context
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idTokenResult = await getIdTokenResult(user);
          const userRole = (idTokenResult.claims.role as string) || "user";
          setRole(userRole);
          setIsWhitelisted(!!idTokenResult.claims.whitelisted);
          setCurrentUser({ ...user, role: userRole });
        } catch (error) {
          console.error("Error fetching user claims:", error);
          setIsWhitelisted(false);
          setRole(null);
          setCurrentUser(null);
        }
      } else {
        setIsWhitelisted(false);
        setRole(null);
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    isWhitelisted,
    role,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

// ✅ Export as named exports (Fixes HMR issue)
export { AuthProvider, useAuth };