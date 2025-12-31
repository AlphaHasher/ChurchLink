import { Render } from "@measured/puck";
import { config, type PuckData } from "../config";

interface PuckPageRendererProps {
  data: PuckData;
}

export function PuckPageRenderer({ data }: PuckPageRendererProps) {
  return <Render config={config} data={data} />;
}
