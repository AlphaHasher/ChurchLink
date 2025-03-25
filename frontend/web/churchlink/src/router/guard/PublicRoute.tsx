import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router';
// import { useAuthStore } from "../../features/auth/hooks/useAuthStore";
import { useAuth } from "@/lib/auth-context";

interface PublicRouteProps {
  children: ReactNode;
}

export const PublicRoute = ({ children }: PublicRouteProps) => {
  const { user, loading } = useAuth();

  //print user on mount
  useEffect(()=>{
    console.log(user);
  },[])



  // While loading, don't render anything yet
  if (loading) {
    return <div>Loading...</div>;
  }

  // If user is authenticated, redirect to the homepage
  return user ? <Navigate to="/" replace /> : <>{children}</>;
};