import { User } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/auth-context";

const WebBuilderTopBar = () => {
  const { user } = useAuth();

  return (
    <div className="w-full bg-white shadow-md p-4 flex justify-between items-center">
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2">
            <User className="text-xl" />
            <span>{user.email}</span>
          </div>
        )}
      </div>
    </div>
    
  );
};

export default WebBuilderTopBar;
