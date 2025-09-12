import * as React from "react";
import { EditPersonDialog } from "./EditPersonDialog";
import { DeletePersonDialog } from "./DeletePersonDialog";
import { PersonDetails } from "@/shared/types/Person";

type Props = {
    person: PersonDetails;
    className?: string;
};

export const PersonTile: React.FC<Props> = ({ person, className }) => {
    return (
        <li
            className={[
                "flex items-center gap-3 rounded-md border bg-muted/30 p-3",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {/* Avatar/initials */}
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 text-sm font-semibold text-gray-700">
                {initials(person.firstName, person.lastName)}
            </div>

            {/* Name + meta */}
            <div className="flex-1">
                <div className="text-sm font-medium leading-5">
                    {person.firstName} {person.lastName}
                </div>
                <div className="text-xs text-muted-foreground">
                    DOB: {formatDob(person.dob)}, Gender: {person.gender}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <EditPersonDialog person={person} />
                <DeletePersonDialog person={person} />
            </div>
        </li>
    );
};

/* local helpers */
function initials(first: string, last: string) {
    const f = first?.trim()?.[0] ?? "";
    const l = last?.trim()?.[0] ?? "";
    return (f + l).toUpperCase();
}
function formatDob(dob: { mm: string; dd: string; yyyy: string }) {
    const mm = String(parseInt(dob.mm || "0", 10));
    const dd = String(parseInt(dob.dd || "0", 10));
    return `${mm}/${dd}/${dob.yyyy}`;
}