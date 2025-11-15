import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import type { TransactionSummary } from "@/shared/types/Transactions";
import { BanknoteArrowDown } from "lucide-react";

type Props = {
    tx: TransactionSummary;
};

export default function RequestRefundDialog({ tx }: Props) {
    // Placeholder copy; real flow (per-line selections, reasons, etc.)
    // will replace this later.
    const label =
        tx.kind === "event"
            ? "Request refund for this event payment"
            : tx.kind === "form"
                ? "Request refund for this form payment"
                : "Request refund";

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                    <BanknoteArrowDown className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Request Refund</DialogTitle>
                    <DialogDescription>{label}</DialogDescription>
                </DialogHeader>

                <div className="py-4 text-sm">
                    HI
                </div>
            </DialogContent>
        </Dialog>
    );
}
