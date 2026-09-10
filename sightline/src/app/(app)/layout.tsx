import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { can, departmentScope, ROLE_LABEL } from "@/lib/rbac";
import { currentMonth, renewals, shadowIt } from "@/lib/queries";
import { SidebarNav, type NavItem } from "@/components/nav";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { VendorSearch } from "@/components/vendor-search";
import { monthLabel } from "@/lib/format";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const scope = { orgId: user.orgId, deptId: departmentScope(user) };
  const month = currentMonth();
  const urgentRenewals = renewals(scope, 30, month).length;
  const newFindings = shadowIt(scope).filter((finding) => finding.status === "new").length;

  const items: NavItem[] = [
    { href: "/dashboard", label: "Overview", group: "Portfolio" },
    { href: "/vendors", label: "Vendors", group: "Portfolio" },
    { href: "/spend", label: "Spend & invoices", group: "Portfolio" },
    { href: "/seats", label: "Seats & licences", group: "Optimise" },
    { href: "/overages", label: "Overages", group: "Optimise" },
    {
      href: "/renewals",
      label: "Renewals",
      group: "Optimise",
      badge: urgentRenewals ? String(urgentRenewals) : undefined,
    },
    { href: "/budgets", label: "Budgets & chargeback", group: "Govern" },
    {
      href: "/shadow-it",
      label: "Shadow IT",
      group: "Govern",
      badge: newFindings ? String(newFindings) : undefined,
    },
  ];
  if (can(user, "user.manage")) items.push({ href: "/settings/users", label: "Users & roles", group: "Admin" });
  if (can(user, "audit.view")) items.push({ href: "/settings/audit", label: "Audit log", group: "Admin" });

  return (
    <div className="min-h-dvh">
      <SidebarNav items={items} org={user.orgName} />

      <div className="lg:pl-[248px]">
        <header
          className="sticky top-0 z-20 flex h-[60px] items-center justify-between gap-4 px-4 pl-14 sm:px-6 lg:pl-6"
          style={{
            background: "color-mix(in srgb, var(--page) 88%, transparent)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <VendorSearch />
            <span className="hidden whitespace-nowrap text-[12px] xl:inline" style={{ color: "var(--ink-3)" }}>
              Billing period {monthLabel(month, "long")}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {user.role === "dept_owner" && user.departmentName ? (
              <span className="badge badge-accent hidden sm:inline-flex">Scoped to {user.departmentName}</span>
            ) : null}
            <ThemeToggle />
            <UserMenu
              name={user.name}
              email={user.email}
              role={ROLE_LABEL[user.role]}
              department={user.departmentName}
            />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
