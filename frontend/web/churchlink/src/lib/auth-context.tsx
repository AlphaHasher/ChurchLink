import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { auth, onAuthStateChanged } from './firebase';
// import { useIsMobile } from '@/hooks/use-mobile';


//whitelisted is an example claim that will need to be changed later
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isWhitelisted: boolean;
}

//whitelisted is an example claim that will need to be changed later
const AuthContext = createContext<AuthContextType>({ 
  currentUser: null, 
  loading: true,
  isWhitelisted: false
});


export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  //example claim will need to change later
  const [isWhitelisted, setIsWhitelisted] = useState(false);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          // Get the ID token with fresh claims
          const idTokenResult = await user.getIdTokenResult(true);
          
          // Check if user has the whitelisted claim
          const whitelisted = !!idTokenResult.claims.whitelisted;
          setIsWhitelisted(whitelisted);
        
          // }
        } catch (error) {
          console.error("Error fetching user claims:", error);
          setIsWhitelisted(false);
        }
      } else {
        setIsWhitelisted(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);


  const value = {
    currentUser,
    loading,
    isWhitelisted,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}