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

  useEffect(() => {
    // Check for testing auth first
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
        
        // Don't set up Firebase listener if we're using testing tokens
        // Return early to prevent Firebase from clearing our testing state
        return;
      } catch (error) {
        console.error("Error parsing testing user:", error);
        localStorage.removeItem("TESTING_AUTH_USER");
        localStorage.removeItem("TESTING_AUTH_TOKEN");
        localStorage.removeItem("TESTING_AUTH_EMAIL");
      }
    }

    // Only set up Firebase listener if NOT using testing tokens
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Only clear testing tokens if Firebase user is null AND we're not currently using testing tokens
      if (!user && !localStorage.getItem("TESTING_AUTH_TOKEN")) {
        localStorage.removeItem("TESTING_AUTH_USER");
        localStorage.removeItem("TESTING_AUTH_TOKEN");
        localStorage.removeItem("TESTING_AUTH_EMAIL");
      }
      
      // If we have testing tokens, don't let Firebase override the state
      if (localStorage.getItem("TESTING_AUTH_TOKEN")) {
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

    return unsubscribe;
  }, []);

  const value = {
    user,
    loading,
    isWhitelisted,
    role,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

// ✅ Export as named exports (Fixes HMR issue)
export { AuthProvider, useAuth };