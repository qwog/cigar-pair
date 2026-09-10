import type { Metadata } from "next";
import { currentCsrfToken, requireUser } from "@/lib/auth";
import { can, CAPABILITIES, ROLE_BLURB, ROLE_LABEL } from "@/lib/rbac";
import { departmentOptions, orgUsers } from "@/lib/queries";
import { ActionForm } from "@/components/action-form";
import { inviteUser, updateUser } from "@/app/(app)/actions";
import { AccessDenied, Badge, Card, CardHead, PageHeader, StatusBadge } from "@/components/ui";
import { ROLES } from "@/db/schema";
import { dateTimeLabel, initials } from "@/lib/format";

export const metadata: Metadata = { title: "Users & roles" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await requireUser();
  if (!can(user, "user.manage")) return <AccessDenied what="user administration" />;

  const csrf = await currentCsrfToken();
  const people = orgUsers(user.orgId);
  const departments = departmentOptions(user.orgId);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Users & roles"
        sub="Access is capability-based: a role is a bundle of capabilities, and every page and server action checks the capability rather than the role name."
      />

      <Card className="mb-4">
          <CardHead title={`${people.length} accounts`} sub="Role changes take effect on the user's next request." />
          <div className="tbl-scroll thin-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last sign-in</th>
                  <th style={{ width: 320 }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                          style={{ background: "var(--surface-3)", color: "var(--ink-2)" }}
                        >
                          {initials(person.name)}
                        </span>
                        <span>
                          <span className="block font-semibold" style={{ color: "var(--ink)" }}>
                            {person.name}
                            {person.id === user.id ? <Badge tone="accent">You</Badge> : null}
                          </span>
                          <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                            {person.email}
                            {person.title ? ` · ${person.title}` : ""}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{person.department ?? "—"}</td>
                    <td>
                      <Badge tone="neutral">{ROLE_LABEL[person.role as keyof typeof ROLE_LABEL]}</Badge>
                    </td>
                    <td>
                      <StatusBadge tone={person.status === "active" ? "good" : "critical"} label={person.status} />
                    </td>
                    <td className="whitespace-nowrap" style={{ color: "var(--ink-3)" }}>
                      {person.lastLoginAt ? dateTimeLabel(person.lastLoginAt) : "Never"}
                    </td>
                    <td>
                      <ActionForm
                        action={updateUser}
                        submitLabel="Save"
                        submitClass="btn btn-sm"
                        className="flex items-end gap-2 [&>div]:mt-0"
                      >
                        <input type="hidden" name="csrf" value={csrf} />
                        <input type="hidden" name="userId" value={person.id} />
                        <label className="sr-only" htmlFor={`role-${person.id}`}>
                          Role for {person.name}
                        </label>
                        <select id={`role-${person.id}`} name="role" defaultValue={person.role} className="field h-8 w-[132px] text-[12px]">
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABEL[role]}
                            </option>
                          ))}
                        </select>
                        <label className="sr-only" htmlFor={`status-${person.id}`}>
                          Status for {person.name}
                        </label>
                        <select id={`status-${person.id}`} name="status" defaultValue={person.status} className="field h-8 w-[92px] text-[12px]">
                          <option value="active">Active</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
            <CardHead title="Add a user" sub="Passwords are hashed with scrypt (N=2¹⁷). Minimum twelve characters." />
            <div className="px-5 pb-5">
              <ActionForm action={inviteUser} submitLabel="Create account">
                <input type="hidden" name="csrf" value={csrf} />
                <label className="label" htmlFor="new-name">
                  Full name
                </label>
                <input id="new-name" name="name" required className="field h-9 text-[13px]" placeholder="Alex Whitfield" />

                <label className="label mt-3" htmlFor="new-email">
                  Work email
                </label>
                <input id="new-email" name="email" type="email" required className="field h-9 text-[13px]" placeholder="alex@arclight.systems" />

                <label className="label mt-3" htmlFor="new-role">
                  Role
                </label>
                <select id="new-role" name="role" defaultValue="viewer" className="field h-9 text-[13px]">
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABEL[role]}
                    </option>
                  ))}
                </select>

                <label className="label mt-3" htmlFor="new-dept">
                  Department
                </label>
                <select id="new-dept" name="departmentId" defaultValue="" className="field h-9 text-[13px]">
                  <option value="">No department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>

                <label className="label mt-3" htmlFor="new-password">
                  Temporary password
                </label>
                <input
                  id="new-password"
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  className="field h-9 text-[13px]"
                  placeholder="At least 12 characters"
                />
              </ActionForm>
            </div>
          </Card>

          <Card>
            <CardHead title="What each role can do" />
            <ul className="px-5 pb-5">
              {ROLES.map((role) => (
                <li key={role} className="border-b py-3 last:border-0" style={{ borderColor: "var(--line)" }}>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                    {ROLE_LABEL[role]}
                  </p>
                  <p className="mt-0.5 text-[12px]" style={{ color: "var(--ink-3)" }}>
                    {ROLE_BLURB[role]}
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-1">
                    {Object.entries(CAPABILITIES)
                      .filter(([, roles]) => (roles as readonly string[]).includes(role))
                      .map(([capability]) => (
                        <Badge key={capability} tone="neutral">
                          {capability}
                        </Badge>
                      ))}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
      </div>
    </>
  );
}
