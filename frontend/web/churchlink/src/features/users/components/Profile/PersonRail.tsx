import * as React from "react";
import { PersonDetails } from "@/shared/types/Person";
import { PersonTile } from "./PersonTile";
import { AddPersonDialog } from "./AddPersonDialog";

type PersonRailProps = {
    people?: PersonDetails[];
    placeholderCount?: number;
    className?: string;
};

export const PersonRail: React.FC<PersonRailProps> = ({
    people,
    placeholderCount = 3,
    className,
}) => {
    const heading = "Family Members";

    return (
        <aside className={["w-full lg:flex-1", className].filter(Boolean).join(" ")}>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-base font-semibold flex-1">{heading}</h3>
                    <AddPersonDialog />
                </div>

                {people && people.length > 0 ? (
                    <ul className="space-y-3">
                        {people.map((p) => (
                            <PersonTile key={p.id} person={p} />
                        ))}
                    </ul>
                ) : (
                    <div className="space-y-3">
                        {Array.from({ length: placeholderCount }).map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 rounded-md border bg-muted/30 p-3"
                            >
                                <div className="h-10 w-10 rounded-full bg-gray-300 animate-pulse" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 w-1/3 rounded bg-gray-300/80 animate-pulse" />
                                    <div className="h-3 w-1/4 rounded bg-gray-200 animate-pulse" />
                                </div>
                                <div className="h-8 w-8 rounded-md bg-gray-200 animate-pulse" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
};