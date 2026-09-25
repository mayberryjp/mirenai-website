import type { RouteRecordRaw } from "vue-router";

const privateRoutes: RouteRecordRaw[] = [
  {
    path: "/policies",
    name: "policies",
    component: () => import("@/views/PoliciesView.vue")
  },
  {
    path: "/upstreams",
    name: "upstreams",
    component: () => import("@/views/UpstreamsView.vue")
  },
  {
    path: "/blocklists",
    name: "blocklists",
    component: () => import("@/views/BlocklistsView.vue")
  },
  {
    path: "/queries",
    name: "queries",
    component: () => import("@/views/QueriesView.vue")
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("@/views/SettingsView.vue")
  }
];

export default privateRoutes;
