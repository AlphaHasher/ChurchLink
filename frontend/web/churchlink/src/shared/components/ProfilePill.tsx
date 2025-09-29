import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/auth-context";
import { Link } from "react-router-dom";
import { auth, signOut } from "@/lib/firebase";
import AvatarImg from "./AvatarImg";

interface ProfilePillProps {
  className?: string;
}

export const ProfilePill = ({ className }: ProfilePillProps) => {
  const { user } = useAuth();

  // Helper function to get display name
  const getDisplayName = (): string => {
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0]; // Use part before @ if no display name
    return 'User';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className={`flex items-center gap-3 p-3 rounded-full border border-border bg-background hover:bg-accent cursor-pointer transition-colors ${className}`}>
          <Avatar className="h-8 w-8 rounded-full">
            <AvatarImg
              user={{
                id: user?.uid,
                google_uuid: user?.uid,
                url_picture: user?.photoURL || undefined,
                displayName: user?.displayName || undefined,
                email: user?.email || undefined
              }}
              className="h-full w-full rounded-full object-cover"
            />
            <AvatarFallback className="text-xs">
              {getDisplayName()
                .split(" ")
                .map((name: string) => name.charAt(0).toUpperCase())
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium truncate">
              {getDisplayName()}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {user?.email}
            </span>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56"
        align="start"
        side="top"
      >
        <DropdownMenuItem asChild>
          <Link
            to="/admin/settings"
            className="flex items-center gap-2 cursor-pointer"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => signOut(auth)}
          className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfilePill;
