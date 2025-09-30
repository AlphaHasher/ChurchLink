import * as React from "react";
import { useAuth } from "@/features/auth/hooks/auth-context";
import VerifyEmailDialog from "../components/email_verification/VerifyEmailDialog";

const VerifyEmailPage: React.FC = () => {
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-white">
            <VerifyEmailDialog email={user?.email ?? ""} />
        </div>
    );
};

export default VerifyEmailPage;
