import { createApp } from "vue";
import App from "@/App.vue";
import router from "@/router";
import { createPinia } from "pinia";
import vuetify from "@/plugins/vuetify";
import VueApexCharts from "vue3-apexcharts";

// Full precompiled Vuetify CSS in one file (paired with styles:"none" in vite.config
// so components don't each request their own CSS in dev).
import "vuetify/dist/vuetify.css";
import "@mdi/font/css/materialdesignicons.css";
import "@/assets/styles/tokens.css";
import "@/assets/styles/globals.css";
// Imported after vuetify/styles so its table overrides win the cascade.
import "@/assets/styles/app-table.css";

const app = createApp(App);
app.use(router);
app.use(createPinia());
app.use(vuetify);
app.use(VueApexCharts);
app.mount("#app");
