import * as React from "react";
import { useAuth } from "@/features/auth/hooks/auth-context";
import InitProfileDialog from "@/features/users/components/Profile/InitProfileDialog";

const InitProfilePage: React.FC = () => {
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-white">
            <InitProfileDialog email={user?.email ?? ""} />
        </div>
    );
};

export default InitProfilePage;
