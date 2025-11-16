import * as React from "react";
import { getAuth, sendPasswordResetEmail, signOut } from "firebase/auth";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { useLocalize } from "@/shared/utils/localizationUtils";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter,
} from "@/shared/components/ui/Dialog";

export default function ChangePasswordDialog() {
  const localize = useLocalize();

  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const auth = getAuth();
  const [email, setEmail] = React.useState(auth.currentUser?.email ?? "");

  React.useEffect(() => {
    if (open) setEmail(getAuth().currentUser?.email ?? "");
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const a = getAuth();
    const targetEmail = a.currentUser?.email ?? email.trim();
    if (!targetEmail) {
      setErr(localize("Enter your email."));
      return;
    }

    try {
      setBusy(true);
      await sendPasswordResetEmail(a, targetEmail);

      if (a.currentUser?.email?.toLowerCase() === targetEmail.toLowerCase()) {
        await signOut(a);
      }

      setOpen(false);
      alert(`${localize("A password reset link has been sent to")} ${targetEmail}.`);
    } catch (e: any) {
      setErr(localize(e?.message || "Failed to send reset email."));
    } finally {
      setBusy(false);
    }
  }

  const emailLocked = Boolean(auth.currentUser?.email);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          className="whitespace-normal break-words text-left"
        >
          {localize("Change Password")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{localize("Change Password")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>{localize("Email")}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={emailLocked}
              required
            />
            <p className="text-xs text-muted-foreground">
              {localize("We’ll send a reset link to")} {emailLocked ? localize("your current email") : localize("this address")}.
            </p>
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              {localize("Cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {localize("Send Reset Email")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
