// Primary navigation, shared by the desktop header button row (AppHeader) and the
// mobile/tablet slide-out drawer (AppLayout) so both stay in sync.
export interface NavItem {
  title: string;
  icon: string;
  routeName?: string;
  href?: string;
}

export const navItems: NavItem[] = [
  { title: "Dashboard", icon: "mdi-view-dashboard", routeName: "dashboard" },
  { title: "Query Log", icon: "mdi-format-list-bulleted", routeName: "queries" },
  {
    title: "Documentation",
    icon: "mdi-book-open-page-variant",
    href: "https://github.com/mayberryjp/mirenai"
  },
  { title: "Settings", icon: "mdi-cog-outline", routeName: "settings" }
];

// External "Requests & Roadmap" link shown alongside the nav items.
export const githubLink = {
  title: "Requests & Roadmap",
  icon: "mdi-github",
  href: "https://github.com/mayberryjp/mirenai/issues"
};
