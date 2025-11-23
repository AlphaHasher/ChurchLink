import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getIdTokenResult } from 'firebase/auth';
import { auth, onAuthStateChanged } from '@/lib/firebase';

// Extend Firebase User to include role
interface AuthUser extends User {
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
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
  const [user,  setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const checkTestingAuth = () => {
    const testingUserStr = localStorage.getItem("TESTING_AUTH_USER");
    const testingToken = localStorage.getItem("TESTING_AUTH_TOKEN");
    
    if (testingUserStr && testingToken) {
      try {
        const testingUser = JSON.parse(testingUserStr);
        // Create a minimal AuthUser-like object
        const fakeUser = {
          ...testingUser,
          role: "admin", // Admin user for testing
        } as AuthUser;
        setUser(fakeUser);
        setRole("admin");
        setIsWhitelisted(true);
        setLoading(false);
        return true;
      } catch (error) {
        console.error("Error parsing testing user:", error);
        localStorage.removeItem("TESTING_AUTH_USER");
        localStorage.removeItem("TESTING_AUTH_TOKEN");
        localStorage.removeItem("TESTING_AUTH_EMAIL");
      }
    }
    return false; 
  };

  useEffect(() => {
    const hasTestingAuth = checkTestingAuth();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "TESTING_AUTH_TOKEN" || e.key === "TESTING_AUTH_USER") {
        checkTestingAuth();
      }
    };
    
    const handleCustomStorageChange = () => {
      checkTestingAuth();
    };
    
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("testingAuthChanged", handleCustomStorageChange);
    
    let unsubscribe: (() => void) | undefined;
    
    if (!hasTestingAuth) {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (checkTestingAuth()) {
          return;
        }
        
        if (!user && !localStorage.getItem("TESTING_AUTH_TOKEN")) {
          localStorage.removeItem("TESTING_AUTH_USER");
          localStorage.removeItem("TESTING_AUTH_TOKEN");
          localStorage.removeItem("TESTING_AUTH_EMAIL");
        }

        if (localStorage.getItem("TESTING_AUTH_TOKEN")) {
          checkTestingAuth();
          return;
        }
        
        if (user) {
          try {
            const idTokenResult = await getIdTokenResult(user);
            const userRole = (idTokenResult.claims.role as string) || "user";
            setRole(userRole);
            setIsWhitelisted(!!idTokenResult.claims.whitelisted);
            setUser({ ...user, role: userRole });
          } catch (error) {
            console.error("Error fetching user claims:", error);
            setIsWhitelisted(false);
            setRole(null);
            setUser(null);
          }
        } else {
          setIsWhitelisted(false);
          setRole(null);
          setUser(null);
        }
        setLoading(false);
      });
    }
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("testingAuthChanged", handleCustomStorageChange);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const value = {
    user,
    loading,
    isWhitelisted,
    role,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export { AuthProvider, useAuth };