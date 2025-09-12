import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { PersonInfo, PersonInfoInput } from "./PersonInfoInput";

export const ProfileEditDialog: React.FC = () => {
    const [email] = React.useState("example@example.com");

    const [person, setPerson] = React.useState<PersonInfo>({
        firstName: "First",
        lastName: "Last",
        dob: { mm: "01", dd: "01", yyyy: "2000" },
        gender: "M",
    });

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="w-full bg-blue-600 text-white hover:bg-blue-700">
                    Update My Information
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Update information</DialogTitle>
                    <DialogDescription>
                        Make changes to your profile details. Your email is read-only.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Used</Label>
                        <Input id="email" value={email} disabled />
                        <p className="text-sm text-muted-foreground">
                            Your account’s email cannot be readily changed like the rest of your information.{" "}
                            <a href="#" className="underline underline-offset-4 hover:no-underline">
                                For assistance in changing your email, please click here
                            </a>.
                        </p>
                    </div>

                    <PersonInfoInput value={person} onChange={setPerson} idPrefix="self" />
                </div>

                <DialogFooter>
                    {/* Close the dialog on click so it "feels" like a save happened */}
                    <DialogClose asChild>
                        <Button type="button">Save changes</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
