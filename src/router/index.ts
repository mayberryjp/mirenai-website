import { createRouter, createWebHistory } from "vue-router";
import publicRoutes from "@/router/routes/publicRoutes";
import privateRoutes from "@/router/routes/privateRoutes";
import errorRoutes from "@/router/routes/errorRoutes";

const router = createRouter({
  history: createWebHistory(),
  routes: [...publicRoutes, ...privateRoutes, ...errorRoutes]
});

router.onError((err) => {
  console.error("router error", err);
  router.push({ name: "error", query: { code: "navigation" } });
});

export default router;
