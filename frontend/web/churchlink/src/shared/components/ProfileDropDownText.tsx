import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@radix-ui/react-dropdown-menu";
import { Button } from "@/shared/components/ui/button";
import { LogOut, User, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { auth, signOut } from "@/lib/firebase";

interface ProfileDropDownProps {
  className?: string;
}

function ProfileDropDownText({ className }: ProfileDropDownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`${className}`}
        >
          Profile
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
          onClick={async () => {
            try {
              console.log("Signing out...");
              await signOut(auth);
              console.log("Sign out successful");
            } catch (error) {
              console.error("Error signing out:", error);
            }
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

export default ProfileDropDownText;
