import type { Role } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL: Role[] = ["admin", "hr", "hiring"];
const HR: Role[] = ["admin", "hr"];
const ADMIN: Role[] = ["admin"];

/** Single source of truth for the internal sidebar and role access to sections. */
export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/hr", label: "Dashboard", icon: "📊", roles: ALL },
      { href: "/hr/analytics", label: "Experience analytics", icon: "💬", roles: HR },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/hr/headcount", label: "Headcount budget", icon: "🧮", roles: HR },
      { href: "/hr/requisitions", label: "Requisitions", icon: "📝", roles: ALL },
      { href: "/hr/job-descriptions", label: "Job description bank", icon: "📚", roles: ALL },
      { href: "/hr/postings", label: "Job postings", icon: "📣", roles: ALL },
    ],
  },
  {
    label: "Hire",
    items: [
      { href: "/hr/pipeline", label: "Candidate pipeline", icon: "🗂️", roles: ALL },
      { href: "/hr/candidates", label: "Talent database", icon: "👥", roles: HR },
      { href: "/hr/screening", label: "CV screening", icon: "🔎", roles: HR },
      { href: "/hr/shortlisting", label: "Shortlisting", icon: "✅", roles: ALL },
      { href: "/hr/interviews", label: "Interviews", icon: "🎥", roles: ALL },
      { href: "/hr/verification", label: "References & eCIB", icon: "🛡️", roles: HR },
      { href: "/hr/offers", label: "Offers & acceptance", icon: "🤝", roles: HR },
      { href: "/hr/letters", label: "Appointment letters", icon: "✉️", roles: HR },
    ],
  },
  {
    label: "Onboard",
    items: [
      { href: "/hr/orientation", label: "Orientation", icon: "🎓", roles: HR },
      { href: "/hr/onboarding", label: "Onboarding journeys", icon: "🧭", roles: ALL },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/hr/employees", label: "Employee master", icon: "🪪", roles: ALL },
      { href: "/hr/status-changes", label: "Status changes", icon: "🔁", roles: ALL },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/users", label: "User management", icon: "🔐", roles: ADMIN },
      { href: "/admin/master-data", label: "Master data", icon: "🗃️", roles: ADMIN },
      { href: "/admin/integrations", label: "Employee API", icon: "🔌", roles: ADMIN },
      { href: "/admin/settings", label: "Portal settings", icon: "⚙️", roles: ADMIN },
      { href: "/hr/audit", label: "Audit trail", icon: "🧾", roles: HR },
    ],
  },
];

export function navFor(role: Role): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length);
}

/** Roles allowed on a path, from the closest nav entry (longest matching prefix). */
export function rolesForPath(path: string): Role[] | undefined {
  let best: NavItem | undefined;
  for (const g of NAV)
    for (const i of g.items)
      if ((path === i.href || path.startsWith(i.href + "/")) && (!best || i.href.length > best.href.length)) best = i;
  return best?.roles;
}
