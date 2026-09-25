import { createApp } from "vue";
import App from "@/App.vue";
import router from "@/router";
import { createPinia } from "pinia";
import vuetify from "@/plugins/vuetify";

import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import "@/assets/styles/tokens.css";
import "@/assets/styles/globals.css";

const app = createApp(App);
app.use(router);
app.use(createPinia());
app.use(vuetify);
app.mount("#app");
