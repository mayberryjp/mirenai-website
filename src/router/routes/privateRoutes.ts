import type { RouteRecordRaw } from "vue-router";
import AppLayout from "@/components/layout/AppLayout.vue";

// All in-app pages render inside AppLayout (top nav + client sidebar shell).
const privateRoutes: RouteRecordRaw[] = [
  {
    path: "/",
    component: AppLayout,
    children: [
      {
        path: "",
        name: "dashboard",
        component: () => import("@/views/DashboardView.vue")
      },
      {
        path: "clients/:client",
        name: "client",
        component: () => import("@/views/ClientDetailsView.vue")
      },
      {
        path: "queries",
        name: "queries",
        component: () => import("@/views/QueriesView.vue")
      },
      {
        path: "settings",
        name: "settings",
        component: () => import("@/views/SettingsView.vue")
      }
    ]
  }
];

export default privateRoutes;
