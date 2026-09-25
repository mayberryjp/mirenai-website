import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { mdi } from "vuetify/iconsets/mdi";

export default createVuetify({
  components,
  directives,
  icons: {
    defaultSet: "mdi",
    sets: { mdi }
  },
  theme: {
    defaultTheme: "mirenaiTheme",
    themes: {
      mirenaiTheme: {
        dark: true,
        colors: {
          background: "#0a0c10",
          surface: "#0d1117",
          "surface-card": "#0d1117",
          "background-100": "#161b22",
          "background-200": "#1c232c",
          primary: "#3b82f6",
          secondary: "#9E394F",
          success: "#22c55e",
          warning: "#eab308",
          error: "#ef4444",
          info: "#58a6ff",
          rose: "#f63c61",
          burgundy: "#a0364d"
        }
      }
    }
  }
});
