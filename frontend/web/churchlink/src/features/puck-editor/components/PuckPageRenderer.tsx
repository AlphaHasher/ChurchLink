import { useMemo } from "react";
import { Render } from "@measured/puck";
import { config as baseConfig, type PuckData } from "../config";
import { useCustomTemplates } from "../hooks/useCustomTemplates";
import { buildConfigWithTemplates } from "../config/buildConfigWithTemplates";

interface PuckPageRendererProps {
  data: PuckData;
}

export function PuckPageRenderer({ data }: PuckPageRendererProps) {
  const { templates, loading } = useCustomTemplates();

  // Build dynamic config with templates - memoized to avoid recreating on every render
  const dynamicConfig = useMemo(() => {
    if (loading || templates.length === 0) {
      return baseConfig;
    }
    return buildConfigWithTemplates(templates);
  }, [templates, loading]);

  // Show loading state while templates load
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <Render config={dynamicConfig as any} data={data} />;
}
