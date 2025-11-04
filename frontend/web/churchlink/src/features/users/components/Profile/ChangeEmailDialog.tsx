import * as React from "react";
import {
  getAuth, EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail, signOut
} from "firebase/auth";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogTrigger, DialogFooter,
} from "@/shared/components/ui/Dialog";

export default function ChangeEmailDialog() {
  const [open, setOpen] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) { setErr("Not signed in."); return; }

    try {
      setBusy(true);
      if (!password.trim()) {
        setErr("Enter your current password.");
        setBusy(false);
        return;
      }

      const cred = EmailAuthProvider.credential(user.email || "", password);
      await reauthenticateWithCredential(user, cred);
      
      await verifyBeforeUpdateEmail(user, newEmail, {
        url: `${window.location.origin}/auth/action?next=/profile`,
        handleCodeInApp: false,
      });

      await signOut(auth);
      setOpen(false);
      alert("Verification link sent to the new address. Click the link then sign back in.");
    } catch (e: any) {
      const code = e?.code || "";
      if (code === "auth/email-already-in-use") setErr("That email is already in use.");
      else if (code === "auth/invalid-email") setErr("Invalid email.");
      else if (code === "auth/requires-recent-login") setErr("Please reauthenticate and try again.");
      else setErr(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary">Change Email</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Change Email</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>New email</Label>
            <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Current password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)}/>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !password.trim()}>Send Link & Sign Out</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
