import { Link } from "react-router-dom";
import { User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const WebBuilderTopBar = () => {
  const { user } = useAuth();

  return (
    <div className="w-full bg-white shadow-md p-4 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <Link
          to="/admin/webbuilder/add"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          + Add Page
        </Link>
        
      </div>
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
