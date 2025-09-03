import { ReactNode } from "react";

interface PublicRouteProps {
  children: ReactNode;
}

export const PublicRoute = ({ children }: PublicRouteProps) => {
  // If user is authenticated, redirect to the homepage
  return <>{children}</>;
};
