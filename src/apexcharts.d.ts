import type { DefineComponent } from "vue";

// vue3-apexcharts registers <apexchart> globally via app.use(VueApexCharts).
// Declare it so vue-tsc recognises the tag in templates.
declare module "vue" {
  interface GlobalComponents {
    apexchart: DefineComponent<{
      type?: string;
      height?: string | number;
      width?: string | number;
      series?: unknown[];
      options?: Record<string, unknown>;
    }>;
  }
}

export {};
