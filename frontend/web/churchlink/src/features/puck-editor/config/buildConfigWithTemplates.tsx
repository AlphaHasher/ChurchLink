import type { ComponentConfig, Config } from "@measured/puck";
import type { ReactNode } from "react";
import type { CustomTemplate } from "../hooks/useCustomTemplates";
import { config as baseConfig, type PuckData } from "./index";

// Deep clone utility to avoid reference sharing between template instances
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Helper to generate a unique component key from template name
function templateToComponentKey(name: string): string {
  // Convert "My Template Name" to "Template_MyTemplateName"
  return `Template_${name.replace(/[^a-zA-Z0-9]/g, "")}`;
}

// Create a component config from a template
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTemplateComponent(template: CustomTemplate): ComponentConfig<any> {
  const templateData = template.puckData;

  // Get the children from the template data (props.children for Puck 0.19+ Slots API)
  const templateChildren = templateData.props?.children || templateData.content || [];

  return {
    label: template.name,
    fields: {
      // Define a slot field for the children
      // This allows the template's children to be editable after placement
      children: {
        type: "slot" as const,
      },
    },
    defaultProps: {
      // Pre-populate the children slot with the saved template children
      // These will be instantiated when the template is placed on a page
      // Deep clone to ensure each instance gets independent component objects
      children: deepClone(templateChildren),
    },
    render: ({ puck, ...props }: { puck?: { isEditing?: boolean }; children?: ReactNode | (() => ReactNode) }) => {
      // Render children - can be a function (slot render prop) or ReactNode
      const renderChildren = () => {
        if (typeof props.children === "function") {
          return (props.children as () => ReactNode)();
        }
        return props.children;
      };

      // Render the group content - this will be a deep copy of the original
      return (
        <div className="template-block w-full" data-template-name={template.name}>
          <div className="template-content">
            {renderChildren()}
          </div>
        </div>
      );
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildConfigWithTemplates(templates: CustomTemplate[]): Config<any> {
  // Start with a shallow copy of the base config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enhancedConfig: Config<any> = {
    ...baseConfig,
    categories: { ...baseConfig.categories },
    components: { ...baseConfig.components },
  };

  // If no templates, return base config
  if (templates.length === 0) {
    return enhancedConfig;
  }

  // Create component configs for each template
  const templateComponents: string[] = [];

  for (const template of templates) {
    const componentKey = templateToComponentKey(template.name);
    templateComponents.push(componentKey);

    // Add the template as a component
    enhancedConfig.components[componentKey] = createTemplateComponent(template);
  }

  // Add the "Custom" category with all template components
  enhancedConfig.categories = {
    custom: {
      title: "Custom Groups",
      components: templateComponents,
    },
    ...enhancedConfig.categories,
  };

  return enhancedConfig;
}

// Export type for use in PuckEditor
export type { PuckData };
