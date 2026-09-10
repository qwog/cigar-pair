import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { can, departmentScope } from "@/lib/rbac";
import { currentMonth, vendorRows } from "@/lib/queries";
import * as audit from "@/lib/audit";

const HEADERS = [
  "Vendor",
  "Category",
  "Owner",
  "Department",
  "Plan",
  "Status",
  "Risk tier",
  "SSO enforced",
  "Committed seats",
  "Provisioned seats",
  "Active seats",
  "Dormant seats",
  "Unit price (USD/mo)",
  "Billed this month (USD)",
  "Overage this month (USD)",
  "Annualised (USD)",
  "Term end",
  "Auto renew",
  "Notice days",
];

const cell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formula injection before quoting.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET() {
  const user = await requireUser();
  if (!can(user, "export.data")) {
    await audit.record(user, "export.denied", "report", null, "vendor export");
    return new NextResponse("Your role cannot export data.", { status: 403 });
  }

  const month = currentMonth();
  const rows = vendorRows({ orgId: user.orgId, deptId: departmentScope(user) }, month);
  await audit.record(user, "export.data", "report", null, `vendor export, ${rows.length} rows, ${month}`);

  const body = [
    HEADERS.map(cell).join(","),
    ...rows.map((vendor) =>
      [
        vendor.name,
        vendor.category,
        vendor.ownerName,
        vendor.department,
        vendor.planName,
        vendor.status,
        vendor.riskTier,
        vendor.ssoEnforced ? "yes" : "no",
        vendor.committedSeats,
        vendor.provisioned,
        vendor.active,
        vendor.dormant,
        ((vendor.unitPriceCents ?? 0) / 100).toFixed(2),
        (vendor.monthCents / 100).toFixed(2),
        (vendor.overageCents / 100).toFixed(2),
        ((vendor.monthCents * 12) / 100).toFixed(2),
        vendor.termEnd,
        vendor.autoRenew ? "yes" : "no",
        vendor.noticeDays,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");

  return new NextResponse(`﻿${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sightline-vendors-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
