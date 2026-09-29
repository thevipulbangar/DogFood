import type { Role } from "./data";
import {
  LayoutGrid, FolderKanban, Users, Gavel, Vote, Trophy, Award, BarChart3,
  Settings2, ScrollText, FileEdit, type LucideIcon,
} from "lucide-react";

// UI routing only. The server is the authority on every permission —
// these rules decide what to *show*, never what is *allowed*.

export type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[]; group: "main" | "admin"; shortcut?: string };

const ALL: Role[] = ["participant", "judge", "organizer", "admin"];
const STAFF: Role[] = ["organizer", "admin"];

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, roles: ALL, group: "main", shortcut: "G O" },
  { href: "/gallery", label: "Projects", icon: FolderKanban, roles: ALL, group: "main", shortcut: "G P" },
  { href: "/teams", label: "Team", icon: Users, roles: ["participant", ...STAFF], group: "main", shortcut: "G T" },
  { href: "/submission", label: "Submission", icon: FileEdit, roles: ["participant"], group: "main", shortcut: "G S" },
  { href: "/judging", label: "Judging", icon: Gavel, roles: ["judge", ...STAFF], group: "main", shortcut: "G J" },
  { href: "/voting", label: "Voting", icon: Vote, roles: ALL, group: "main", shortcut: "G V" },
  { href: "/results", label: "Results", icon: Trophy, roles: ALL, group: "main", shortcut: "G R" },
  { href: "/certificates", label: "Certificates", icon: Award, roles: ["participant", "judge", ...STAFF], group: "main" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, roles: STAFF, group: "main" },
  { href: "/admin", label: "Administration", icon: Settings2, roles: STAFF, group: "admin" },
  { href: "/audit", label: "Audit Log", icon: ScrollText, roles: STAFF, group: "admin" },
];

/** Routes a role may open. Judging sessions are judge-only (role isolation). */
const ROUTE_RULES: [prefix: string, roles: Role[]][] = [
  ["/judging/", ["judge"]],
  ...NAV.map((n) => [n.href, n.roles] as [string, Role[]]),
];

export function canView(role: Role, pathname: string) {
  const rule = ROUTE_RULES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : prefix + "/"));
  return rule ? rule[1].includes(role) : true;
}

export const navFor = (role: Role) => NAV.filter((n) => n.roles.includes(role));

export const ROLE_LABEL: Record<Role, string> = {
  participant: "Participant",
  judge: "Judge",
  organizer: "Organizer",
  admin: "Admin",
};
