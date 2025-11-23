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
    // Check for E2E test mode
    const isE2EMode = (() => {
      try {
        return typeof window !== 'undefined' && !!window.Cypress;
      } catch {
        return false;
      }
    })();

    // In E2E mode, provide mock authenticated admin user
    if (isE2EMode) {
      const mockUser: AuthUser = {
        uid: 'e2e-test-admin-uid',
        email: 'admin@e2etest.com',
        displayName: 'E2E Test Admin',
        role: 'admin',
        emailVerified: true,
        isAnonymous: false,
        metadata: {
          creationTime: new Date().toISOString(),
          lastSignInTime: new Date().toISOString(),
        },
        providerData: [],
        refreshToken: 'mock-refresh-token',
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => 'mock-e2e-token',
        getIdTokenResult: async () => ({
          token: 'mock-e2e-token',
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
          authTime: new Date().toISOString(),
          issuedAtTime: new Date().toISOString(),
          signInProvider: 'password',
          claims: { role: 'admin', whitelisted: true },
          signInSecondFactor: null,
        }),
        reload: async () => {},
        toJSON: () => ({}),
      };

      setRole('admin');
      setIsWhitelisted(true);
      setUser(mockUser);
      setLoading(false);
      return () => {}; // No cleanup needed for mock
    }

    // Normal Firebase auth flow
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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