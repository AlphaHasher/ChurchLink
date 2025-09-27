import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog";

type VerifyEmailDialogProps = {
    email: string;
    className?: string;
};

// Always-open, cannot be closed by ESC, backdrop, or outside clicks.
const VerifyEmailDialog: React.FC<VerifyEmailDialogProps> = ({ email, className }) => {
    return (
        <Dialog open onOpenChange={() => { }}>
            <DialogContent
                className={["sm:max-w-md", className].filter(Boolean).join(" ")}
                onEscapeKeyDown={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>Verify your email</DialogTitle>
                    <DialogDescription>
                        Please verify the email associated with your account.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 text-base">
                    <span className="font-medium">Email:</span> {email || "(unknown)"}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default VerifyEmailDialog;
