import type { ComponentConfig, Config } from "@puckeditor/core";
import type { CustomTemplate } from "../hooks/useCustomTemplates";
import { config as baseConfig, type PuckData } from "./index";
import { GroupBlock } from "./components/GroupBlock";

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
// Template_* is a "ghost" component - when placed, it immediately transforms to GroupBlock
// (transformation happens in PuckEditor onChange handler)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTemplateComponent(template: CustomTemplate): ComponentConfig<any> {
  const templateData = template.puckData;

  // Get the children from the template data (props.children for Puck 0.19+ Slots API)
  const templateChildren = templateData.props?.children || templateData.content || [];

  // Use GroupBlock's structure but with template's children as defaultProps
  // This ensures the component picker shows the template with correct structure
  return {
    label: template.name,
    fields: GroupBlock.fields,
    defaultProps: {
      name: template.name,
      // Deep clone to ensure each instance gets independent component objects
      children: deepClone(templateChildren),
    },
    render: GroupBlock.render,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildConfigWithTemplates(templates: CustomTemplate[]): Config<any> {
  // Start with a shallow copy of the base config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enhancedConfig: any = {
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
