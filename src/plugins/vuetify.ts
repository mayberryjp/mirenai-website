import { createVuetify } from "vuetify";
import { mdi } from "vuetify/iconsets/mdi";

export default createVuetify({
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
          primary: "#4a90d9",
          secondary: "#7b61ff",
          success: "#2ec4a0",
          warning: "#f5a623",
          error: "#ff5a36",
          info: "#5b8def",
          rose: "#7b61ff",
          burgundy: "#a0364d",
          teal: "#2ec4a0",
          amber: "#ffc93c",
          orange: "#f5822a",
          purple: "#7b61ff"
        }
      }
    }
  }
});
