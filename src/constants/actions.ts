import type { LoggedAction } from "@/types/domain";

// Colors mirror the Site DNS Traffic chart series.
export const ACTION_COLORS = {
  forward: "#7b61ff",
  "forward-cache": "#2ec4a0",
  override: "#ffc93c",
  deny: "#f5822a",
  blocklist: "#ff5a36",
  servfail: "#9aa4b2",
  local: "#e056a0",
  nodata: "grey"
} as const satisfies Record<LoggedAction, string>;

// Label for the resolver's recorded response (last_action).
export function loggedActionLabel(action: string | null | undefined): string {
  switch (action) {
    case "forward":
      return "Forwarded Response";
    case "forward-cache":
      return "Cached Response";
    case "override":
      return "Spoof";
    case "deny":
      return "Policy Denied";
    case "blocklist":
      return "Blocklist Denied";
    case "servfail":
      return "Server Failure";
    case "local":
      return "Local";
    case "nodata":
      return "No Data";
    default:
      return "—";
  }
}

export function loggedActionColor(action: string | null | undefined): string {
  return action && action in ACTION_COLORS
    ? ACTION_COLORS[action as LoggedAction]
    : "grey";
}
