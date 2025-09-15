import * as React from "react";
import { PersonDetails } from "@/shared/types/Person";
import { PersonTile } from "./PersonTile";
import { AddPersonDialog } from "./AddPersonDialog";

type PersonRailProps = {
    people?: PersonDetails[];
    className?: string;
};

export const PersonRail: React.FC<PersonRailProps> = ({ people, className }) => {
    const heading = "Family Members";

    const [list, setList] = React.useState<PersonDetails[]>(people ?? []);
    React.useEffect(() => setList(people ?? []), [people]);

    return (
        <aside className={["w-full lg:flex-1", className].filter(Boolean).join(" ")}>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-base font-semibold flex-1">{heading}</h3>
                    <AddPersonDialog onAdded={(p) => setList((prev) => [...prev, p])} />
                </div>

                {list.length > 0 ? (
                    <ul className="space-y-3">
                        {list.map((p) => (
                            <PersonTile
                                key={p.id}
                                person={p}
                                onUpdated={(next) =>
                                    setList((prev) => prev.map((it) => (it.id === next.id ? next : it)))
                                }
                                onDeleted={(id) =>
                                    setList((prev) => prev.filter((it) => it.id !== id))
                                }
                            />
                        ))}
                    </ul>
                ) : (
                    <div className="text-sm text-gray-500">
                        You have not added any Family Members to your account.
                    </div>
                )}
            </div>
        </aside>
    );
};
