import * as React from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import ViewEventDetails from "../components/ViewEventDetails";
import { useLocalize } from "@/shared/utils/localizationUtils";

export default function SharableEvent() {
    const { instanceId } = useParams<{ instanceId: string }>();
    const [open, setOpen] = React.useState(true);
    const localize = useLocalize();

    if (!instanceId) {
        return <div className="p-6 text-sm">{localize("Missing instance id")}</div>;
    }

    return (
        <div className="w-full mx-auto max-w-5xl px-6 py-10">
            {/* EVENT DETAILS DIALOG */}
            <ViewEventDetails
                instanceId={instanceId}
                open={open}
                onOpenChange={setOpen}
            />

            {/* Button to re-open dialog in case the user closes it and wants to see it again */}
            <div className="mx-auto max-w-xl text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                    {localize('Click \"View Event\" below to re-open the event you were linked to, or explore other parts of our site!')}
                </p>
                <div>
                    <Button onClick={() => setOpen(true)} size="lg" className="px-6">
                        {localize("View Event")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
