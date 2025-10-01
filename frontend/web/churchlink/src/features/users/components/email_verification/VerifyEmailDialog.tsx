import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import { Mail } from "lucide-react";
import { auth, signOut } from "@/lib/firebase";
import { sendEmailVerification } from "firebase/auth";
import { useNavigate } from "react-router-dom";

// helpers
import { verifyAndSyncUser, getIsInit } from "@/helpers/UserHelper";

type VerifyEmailDialogProps = {
    email: string;
    className?: string;
};

const VerifyEmailDialog: React.FC<VerifyEmailDialogProps> = ({ email, className }) => {
    const navigate = useNavigate();

    const [cooldown, setCooldown] = React.useState(0);
    const [isPolling, setIsPolling] = React.useState(false);
    const [hasSent, setHasSent] = React.useState(false);

    const cdRef = React.useRef<number | null>(null);
    const pollRef = React.useRef<number | null>(null);
    const navigatingRef = React.useRef(false);

    const clearAllTimers = React.useCallback(() => {
        if (cdRef.current) {
            clearInterval(cdRef.current);
            cdRef.current = null;
        }
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    React.useEffect(() => clearAllTimers, [clearAllTimers]);

    const onVerifyError = React.useCallback(async (msg: string) => {
        // Your helper signs out on failure; just surface a message if you want.
        alert(msg);
    }, []);

    // One polling step: verify/sync on server, then check { verified } via your API.
    const pollOnce = React.useCallback(async () => {
        const ok = await verifyAndSyncUser(onVerifyError);
        if (!ok) return;

        const res = await getIsInit(); // { verified: boolean, init: boolean, ... }
        if (res?.verified && !navigatingRef.current) {
            navigatingRef.current = true;
            clearAllTimers();
            setIsPolling(false);
            // Verified — go to home; your guards will route to /auth/init if needed
            navigate("/", { replace: true });
        }
    }, [onVerifyError, navigate, clearAllTimers]);

    // Start 5s polling loop (and fire immediately once)
    const startPolling = React.useCallback(() => {
        if (isPolling) return;
        setIsPolling(true);

        void pollOnce(); // immediate check

        pollRef.current = window.setInterval(() => {
            void pollOnce();
        }, 5000);
    }, [isPolling, pollOnce]);

    // 30s resend cooldown
    const startCooldown = React.useCallback(() => {
        if (cooldown > 0) return;

        setCooldown(30);
        if (cdRef.current) clearInterval(cdRef.current);

        cdRef.current = window.setInterval(() => {
            setCooldown((s) => {
                if (s <= 1) {
                    clearInterval(cdRef.current!);
                    cdRef.current = null;
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
    }, [cooldown]);

    const handleSend = async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            // Adjust these to your needs; ensure the domain is in Auth > Settings > Authorized domains
            await sendEmailVerification(user, {
                url: `${window.location.origin}/`,
                handleCodeInApp: false, // set true only if you implement applyActionCode handling in-app
            });

            setHasSent(true);     // flip label after first successful send
            startCooldown();      // begin 30s cooldown
            startPolling();       // begin 5s verification polling
        } catch (err) {
            console.error("sendEmailVerification failed:", err);
            alert("Could not send verification email. Please try again shortly.");
            // Do NOT start cooldown/polling on failure
        }
    };

    const handleLogout = async () => {
        clearAllTimers();
        await signOut(auth);
    };

    const sendDisabled = cooldown > 0;
    const sendLabel = sendDisabled
        ? `Resend in ${cooldown}s`
        : hasSent
            ? "Re-send verification email"
            : "Send verification email";

    return (
        <Dialog open onOpenChange={() => { }}>
            <DialogContent
                className={[
                    "sm:max-w-sm",
                    "py-8",
                    "text-center",
                    className || "",
                ].join(" ")}
                onEscapeKeyDown={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader className="text-center">
                    <DialogTitle className="text-xl">Verify your email</DialogTitle>
                    <DialogDescription className="mt-1 leading-relaxed">
                        Please verify your email:{" "}
                        <span className="font-medium">{email || "(unknown)"}</span> to continue. You may need to check your spam folder if you cannot find the verification email.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-6 flex items-center justify-center">
                    <Mail aria-hidden="true" className="h-20 w-20 text-gray-700" />
                </div>

                <div className="mt-6 flex flex-col items-center gap-3">
                    <Button
                        type="button"
                        onClick={handleSend}
                        disabled={sendDisabled}
                        className="w-64 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                        {sendLabel}
                    </Button>

                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleLogout}
                        className="w-64"
                    >
                        Logout
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default VerifyEmailDialog;
