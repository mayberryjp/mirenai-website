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
        redirect: { name: "settings-general" },
        component: () => import("@/views/SettingsView.vue"),
        children: [
          {
            path: "general",
            name: "settings-general",
            component: () => import("@/components/settings/GeneralSettingsPanel.vue")
          },
          {
            path: "upstreams",
            name: "settings-upstreams",
            component: () => import("@/components/settings/UpstreamsPanel.vue")
          },
          {
            path: "blocklists",
            name: "settings-blocklists",
            component: () => import("@/components/settings/BlocklistsPanel.vue")
          },
          {
            path: "networking",
            name: "settings-networking",
            component: () => import("@/components/settings/NetworkingPanel.vue")
          },
          {
            path: "advanced",
            name: "settings-advanced",
            component: () => import("@/components/settings/AdvancedPanel.vue")
          }
        ]
      }
    ]
  }
];

export default privateRoutes;
