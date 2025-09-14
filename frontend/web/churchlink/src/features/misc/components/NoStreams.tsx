import * as React from "react";
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/components/ui/card";
import { TvMinimalPlay } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { channel } from "diagnostics_channel";

type NoStreamProps = {
    channel_link: string;
};

export const NoStreams: React.FC<NoStreamProps> = ({ channel_link }) => {
    return (
        <div className="flex w-full items-start justify-center pt-24 pb-24">
            <Card className="w-[28rem] shadow-lg p-6">
                <CardHeader className="text-center">
                    <h2 className="text-3xl font-bold">We are not currently live!</h2>
                </CardHeader>

                <CardContent className="flex flex-col items-center gap-6">
                    <TvMinimalPlay className="h-24 w-24 text-red-600" aria-hidden="true" />

                    <p className="text-base text-muted-foreground text-center">
                        To keep up with our future streams, feel free to stay tuned at the
                        link to our channel below!
                    </p>
                </CardContent>

                <CardFooter className="flex justify-center">
                    <Button
                        asChild
                        className="px-6 py-3 text-base font-semibold bg-red-600"
                    >
                        <a
                            href={channel_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Visit our YouTube Channel"
                        >
                            Go to Channel
                        </a>
                    </Button>
                </CardFooter>
            </Card>

        </div>
    );
};
