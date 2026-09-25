import { createRouter, createWebHistory } from "vue-router";
import privateRoutes from "@/router/routes/privateRoutes";
import errorRoutes from "@/router/routes/errorRoutes";

const router = createRouter({
  history: createWebHistory(),
  routes: [...privateRoutes, ...errorRoutes]
});

router.onError((err) => {
  console.error("router error", err);
  router.push({ name: "error", query: { code: "navigation" } });
});

export default router;
