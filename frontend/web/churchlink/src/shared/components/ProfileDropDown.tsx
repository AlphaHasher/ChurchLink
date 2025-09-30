import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@radix-ui/react-dropdown-menu";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { LogOut, User, Settings } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/auth-context";
import { Link } from "react-router-dom";
import { auth, signOut } from "@/lib/firebase";
import AvatarImg from "./AvatarImg";

interface ProfileDropDownProps {
  className?: string;
}

function ProfileDropDown({ className }: ProfileDropDownProps) {
  const { user } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`flex items-center justify-center p-0 size-9 rounded-full ${className}`}
        >
          <Avatar className="size-full rounded-full">
            <AvatarImg
              user={{
                id: user?.uid,
                google_uuid: user?.uid, // Firebase UID as google_uuid
                url_picture: user?.photoURL || undefined,
                displayName: user?.displayName || undefined,
                email: user?.email || undefined
              }}
              className="size-full rounded-full object-cover"
            />
            <AvatarFallback>
              {user?.displayName
                ?.split(" ")
                .map((name: string) => name.charAt(0).toUpperCase())
                .join("")}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 bg-black/95 border border-white/10 rounded-xl shadow-lg mt-2"
        sideOffset={5}
      >
        <DropdownMenuItem asChild>
          <Link
            to="/profile"
            className="flex items-center gap-2 px-3 py-2 text-sm text-white! hover:bg-white/10 cursor-pointer rounded-lg mx-1 my-0.5"
          >
            <User className="h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            to="/settings"
            className="flex items-center gap-2 px-3 py-2 text-sm text-white! hover:bg-white/10 cursor-pointer rounded-lg mx-1 my-0.5"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            signOut(auth);
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white! hover:bg-white/10 cursor-pointer rounded-lg mx-1 my-0.5"
        >
          <LogOut className="h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ProfileDropDown;
