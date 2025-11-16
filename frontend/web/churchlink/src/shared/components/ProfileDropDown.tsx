import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@radix-ui/react-dropdown-menu";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { CreditCard, LogOut, User } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/auth-context";
import { Link } from "react-router-dom";
import { auth, signOut } from "@/lib/firebase";
import AvatarImg from "./AvatarImg";
import { Shield } from "lucide-react";
import { useLocalize } from "../utils/localizationUtils";

interface ProfileDropDownProps {
  className?: string;
  isMod?: boolean;
}

function ProfileDropDown({ className, isMod }: ProfileDropDownProps) {
  const { user } = useAuth();
  const localize = useLocalize();

  const displayAdminDash: boolean = isMod ?? false;

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
        className="w-56 bg-popover border border-border rounded-xl shadow-lg mt-2 p-1 space-y-1"
        sideOffset={5}
      >
        <DropdownMenuItem asChild>
          <Link
            to="/profile"
            className="flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-lg first:rounded-t-lg last:rounded-b-lg transition-colors duration-200"
          >
            <User className="h-4 w-4" />
            <span>{localize("Profile")}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link
            to="/my-transactions"
            className="flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-lg first:rounded-t-lg last:rounded-b-lg transition-colors duration-200"
          >
            <CreditCard className="h-4 w-4" />
            <span>{localize("My Transactions")}</span>
          </Link>
        </DropdownMenuItem>
        {displayAdminDash ? (
          <DropdownMenuItem asChild>
            <Link
              to="/admin"
              className="flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-lg first:rounded-t-lg last:rounded-b-lg transition-colors duration-200"
              aria-label="Admin Panel"
              title="Admin Panel"
            >
              <Shield className="h-4 w-4" />
              <span>{localize("Admin Panel")}</span>
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem
          onClick={() => {
            signOut(auth);
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-lg first:rounded-t-lg last:rounded-b-lg transition-colors duration-200"
        >
          <LogOut className="h-4 w-4" />
          <span>{localize("Log out")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ProfileDropDown;
