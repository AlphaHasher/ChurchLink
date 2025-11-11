import * as React from "react";
import { getAuth, sendPasswordResetEmail, signOut } from "firebase/auth";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogTrigger, DialogFooter,
} from "@/shared/components/ui/Dialog";

export default function ChangePasswordDialog() {
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
      setErr("Enter your email.");
      return;
    }

    try {
      setBusy(true);
      await sendPasswordResetEmail(a, targetEmail);

      if (a.currentUser?.email?.toLowerCase() === targetEmail.toLowerCase()) {
        await signOut(a);
      }

      setOpen(false);
      alert(`A password reset link has been sent to ${targetEmail}.`);
    } catch (e: any) {
      setErr(e?.message || "Failed to send reset email.");
    } finally {
      setBusy(false);
    }
  }

  const emailLocked = Boolean(auth.currentUser?.email);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Change Password</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={emailLocked}
              required
            />
            <p className="text-xs text-muted-foreground">
              We’ll send a reset link to {emailLocked ? "your current email" : "this address"}.
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
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Send Reset Email
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
