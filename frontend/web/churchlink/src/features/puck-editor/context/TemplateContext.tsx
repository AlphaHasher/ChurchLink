import { createContext, useContext, type ReactNode } from "react";

interface TemplateContextValue {
  saveAsTemplate: (
    puckData: object,
    name: string,
    description?: string
  ) => Promise<void>;
}

const TemplateContext = createContext<TemplateContextValue | null>(null);

interface TemplateProviderProps {
  children: ReactNode;
  saveAsTemplate: TemplateContextValue["saveAsTemplate"];
}

export function TemplateProvider({ children, saveAsTemplate }: TemplateProviderProps) {
  return (
    <TemplateContext.Provider value={{ saveAsTemplate }}>
      {children}
    </TemplateContext.Provider>
  );
}

export function useTemplateContext() {
  const context = useContext(TemplateContext);
  return context;
}
