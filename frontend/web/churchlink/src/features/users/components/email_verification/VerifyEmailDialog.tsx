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
import { useLocalize } from "@/shared/utils/localizationUtils";

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

    const localize = useLocalize();

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
            // Verified — go to home, guards will route to /auth/init if needed
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
            await sendEmailVerification(user, {
                url: `${window.location.origin}/`,
                handleCodeInApp: false,
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
        ? `${localize("Seconds left until you may re-send:")} ${cooldown}`
        : hasSent
            ? localize("Re-send verification email")
            : localize("Send verification email");

    return (
        <Dialog open onOpenChange={() => { }}>
            <DialogContent
                className={[
                    "w-full",
                    "max-w-[100vw]",
                    "sm:max-w-3xl",
                    "overflow-x-auto",
                    "py-8",
                    "text-center",
                    className || "",
                ].join(" ")}
                onEscapeKeyDown={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader className="text-center">
                    <DialogTitle className="text-xl">
                        {localize("Verify your email")}
                    </DialogTitle>
                    <DialogDescription className="mt-1 leading-relaxed">
                        {localize("Please verify your email:")}{" "}
                        <span className="font-medium">{email || "(unknown)"}</span>{" "}
                        {localize(
                            "to continue. You may need to check your spam folder if you cannot find the verification email."
                        )}
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
                        className={[
                            "max-w-full",
                            "whitespace-normal",
                            "break-words",
                            "text-center",
                            "bg-green-600",
                            "text-white",
                            "hover:bg-green-700",
                            "disabled:opacity-50",
                        ].join(" ")}
                    >
                        {localize(sendLabel)}
                    </Button>

                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleLogout}
                        className={[
                            "max-w-full",
                            "whitespace-normal",
                            "break-words",
                            "text-center",
                        ].join(" ")}
                    >
                        {localize("Logout")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default VerifyEmailDialog;
