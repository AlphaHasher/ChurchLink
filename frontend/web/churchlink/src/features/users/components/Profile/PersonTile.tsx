import * as React from "react";
import { EditPersonDialog } from "./EditPersonDialog";
import { DeletePersonDialog } from "./DeletePersonDialog";
import { PersonDetails } from "@/shared/types/Person";
import { useLocalize } from "@/shared/utils/localizationUtils";

type Props = {
    person: PersonDetails;
    className?: string;
    onUpdated?: (p: PersonDetails) => void;
    onDeleted?: (id: string) => void;
};

export const PersonTile: React.FC<Props> = ({ person, className, onUpdated, onDeleted }) => {
    const localize = useLocalize();

    let genderDisplay = person.gender.toString();
    if (genderDisplay === "M") {
        genderDisplay = localize("Male");
    }
    else {
        genderDisplay = localize("Female");
    }

    return (
        <li
            className={[
                "flex items-center gap-3 rounded-md border bg-muted/30 p-3",
                className,
            ].filter(Boolean).join(" ")}
        >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 text-sm font-semibold text-gray-700">
                {initials(person.first_name, person.last_name)}
            </div>

            <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium leading-5">
                    {person.first_name} {person.last_name}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                    {localize("Date of Birth")}: {formatDob(person.date_of_birth)}, {localize("Gender")}: {genderDisplay}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <EditPersonDialog person={person} onUpdated={onUpdated} />
                <DeletePersonDialog person={person} onDeleted={onDeleted} />
            </div>
        </li>
    );
};

function initials(first: string, last: string) {
    const f = first?.trim()?.[0] ?? "";
    const l = last?.trim()?.[0] ?? "";
    return (f + l).toUpperCase();
}
function formatDob(date_of_birth: Date | string): string {
    const d = date_of_birth instanceof Date ? date_of_birth : new Date(date_of_birth);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${mm}/${dd}/${yyyy}`;
}
