/**
 * The fictional company Sightline ships with: Arclight Systems, a 640-person
 * robotics manufacturer. Everything below drives the seeded demo portfolio.
 */

export const ORG = {
  name: "Arclight Systems",
  domain: "arclight.systems",
  fiscalYearStartMonth: 2,
  currency: "USD",
};

export type DeptSeed = {
  name: string;
  costCenter: string;
  headcount: number;
  annualBudget: number; // dollars of SaaS budget
};

export const DEPARTMENTS: DeptSeed[] = [
  { name: "Engineering", costCenter: "CC-1000", headcount: 180, annualBudget: 1_020_000 },
  { name: "Operations", costCenter: "CC-1100", headcount: 100, annualBudget: 84_000 },
  { name: "Sales", costCenter: "CC-2000", headcount: 96, annualBudget: 960_000 },
  { name: "Customer Success", costCenter: "CC-2100", headcount: 58, annualBudget: 168_000 },
  { name: "Marketing", costCenter: "CC-2200", headcount: 42, annualBudget: 372_000 },
  { name: "Product", costCenter: "CC-1200", headcount: 34, annualBudget: 300_000 },
  { name: "Design", costCenter: "CC-1300", headcount: 26, annualBudget: 96_000 },
  { name: "Finance", costCenter: "CC-3000", headcount: 26, annualBudget: 264_000 },
  { name: "Data", costCenter: "CC-1400", headcount: 24, annualBudget: 1_150_000 },
  { name: "IT", costCenter: "CC-3100", headcount: 22, annualBudget: 1_080_000 },
  { name: "People", costCenter: "CC-3200", headcount: 20, annualBudget: 520_000 },
  { name: "Legal", costCenter: "CC-3300", headcount: 12, annualBudget: 122_000 },
];

export type VendorSeed = {
  name: string;
  category: string;
  website: string;
  hue: number; // categorical slot 0-7
  owner: string; // department that owns the contract
  scope: "all" | string[];
  adoption: number; // share of eligible headcount holding a seat today
  utilization: number; // share of provisioned seats active in the last 30 days
  unit: number; // list price per seat per month, dollars
  overageUnit?: number; // per-seat overage rate, dollars (defaults to unit × 1.15)
  platform: number; // fixed platform fee per month, dollars
  commitRatio: number; // committed seats ÷ seats provisioned today (< 1 ⇒ in overage)
  growth: number; // monthly seat growth over the trailing window
  renewalInDays: number;
  termMonths: number;
  autoRenew: boolean;
  noticeDays: number;
  uplift: number; // uplift the vendor is asking for at renewal
  sso: boolean;
  scim: boolean;
  risk: "low" | "medium" | "high";
  data: "public" | "internal" | "confidential" | "restricted";
  plan: string;
  since?: number; // months of billing history (defaults to the full 24-month window)
};

const D = {
  eng: "Engineering",
  ops: "Operations",
  sales: "Sales",
  cs: "Customer Success",
  mkt: "Marketing",
  prod: "Product",
  design: "Design",
  fin: "Finance",
  data: "Data",
  it: "IT",
  people: "People",
  legal: "Legal",
};

export const VENDORS: VendorSeed[] = [
  { name: "Microsoft 365", category: "Productivity", website: "microsoft.com", hue: 0, owner: D.it, scope: "all", adoption: 1.0, utilization: 0.94, unit: 22, platform: 0, commitRatio: 0.88, growth: 0.006, renewalInDays: 118, termMonths: 36, autoRenew: true, noticeDays: 60, uplift: 0.07, sso: true, scim: true, risk: "medium", data: "confidential", plan: "E3 + Entra P1" },
  { name: "Slack", category: "Collaboration", website: "slack.com", hue: 5, owner: D.it, scope: "all", adoption: 0.97, utilization: 0.91, unit: 15, platform: 0, commitRatio: 0.8, growth: 0.009, renewalInDays: 34, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.12, sso: true, scim: true, risk: "medium", data: "confidential", plan: "Business+" },
  { name: "Zoom", category: "Collaboration", website: "zoom.us", hue: 0, owner: D.it, scope: "all", adoption: 0.72, utilization: 0.58, unit: 20, platform: 1_200, commitRatio: 1.18, growth: -0.004, renewalInDays: 61, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.04, sso: true, scim: false, risk: "low", data: "internal", plan: "Business Plus" },
  { name: "Okta", category: "Identity", website: "okta.com", hue: 0, owner: D.it, scope: "all", adoption: 1.0, utilization: 0.98, unit: 8, platform: 2_400, commitRatio: 0.93, growth: 0.006, renewalInDays: 203, termMonths: 24, autoRenew: false, noticeDays: 90, uplift: 0.09, sso: true, scim: true, risk: "high", data: "restricted", plan: "Workforce Identity" },
  { name: "1Password", category: "Security", website: "1password.com", hue: 0, owner: D.it, scope: "all", adoption: 0.99, utilization: 0.86, unit: 8, platform: 0, commitRatio: 0.95, growth: 0.006, renewalInDays: 271, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.05, sso: true, scim: true, risk: "high", data: "restricted", plan: "Business" },
  { name: "CrowdStrike", category: "Security", website: "crowdstrike.com", hue: 7, owner: D.it, scope: "all", adoption: 1.0, utilization: 1.0, unit: 9, platform: 3_800, commitRatio: 0.86, growth: 0.007, renewalInDays: 88, termMonths: 24, autoRenew: false, noticeDays: 60, uplift: 0.14, sso: true, scim: true, risk: "high", data: "restricted", plan: "Falcon Enterprise" },
  { name: "Google Workspace", category: "Productivity", website: "workspace.google.com", hue: 3, owner: D.it, scope: [D.mkt, D.sales, D.cs, D.people], adoption: 0.88, utilization: 0.63, unit: 18, platform: 0, commitRatio: 1.24, growth: -0.002, renewalInDays: 26, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.03, sso: true, scim: false, risk: "medium", data: "confidential", plan: "Business Standard" },
  { name: "GitHub Enterprise", category: "Engineering", website: "github.com", hue: 6, owner: D.eng, scope: [D.eng, D.prod, D.data, D.it], adoption: 0.96, utilization: 0.93, unit: 21, platform: 0, commitRatio: 0.83, growth: 0.011, renewalInDays: 47, termMonths: 12, autoRenew: true, noticeDays: 45, uplift: 0.11, sso: true, scim: true, risk: "high", data: "restricted", plan: "Enterprise Cloud" },
  { name: "Jira Software", category: "Engineering", website: "atlassian.com", hue: 0, owner: D.eng, scope: [D.eng, D.prod, D.design, D.ops, D.it], adoption: 0.9, utilization: 0.79, unit: 16, platform: 0, commitRatio: 1.09, growth: 0.004, renewalInDays: 152, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.08, sso: true, scim: true, risk: "medium", data: "internal", plan: "Premium" },
  { name: "Confluence", category: "Knowledge", website: "atlassian.com", hue: 0, owner: D.eng, scope: [D.eng, D.prod, D.design, D.ops, D.it, D.data], adoption: 0.83, utilization: 0.48, unit: 11, platform: 0, commitRatio: 1.31, growth: -0.003, renewalInDays: 152, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.08, sso: true, scim: true, risk: "low", data: "internal", plan: "Premium" },
  { name: "Notion", category: "Knowledge", website: "notion.so", hue: 4, owner: D.prod, scope: "all", adoption: 0.61, utilization: 0.52, unit: 15, platform: 0, commitRatio: 1.14, growth: 0.008, renewalInDays: 12, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.18, sso: true, scim: false, risk: "medium", data: "confidential", plan: "Business", since: 15 },
  { name: "Figma", category: "Design", website: "figma.com", hue: 4, owner: D.design, scope: [D.design, D.prod, D.eng, D.mkt], adoption: 0.55, utilization: 0.71, unit: 45, platform: 0, commitRatio: 0.78, growth: 0.014, renewalInDays: 73, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.15, sso: true, scim: true, risk: "medium", data: "confidential", plan: "Organization" },
  { name: "Miro", category: "Design", website: "miro.com", hue: 3, owner: D.prod, scope: [D.design, D.prod, D.eng, D.mkt, D.ops], adoption: 0.66, utilization: 0.41, unit: 16, platform: 0, commitRatio: 1.42, growth: -0.006, renewalInDays: 19, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.06, sso: true, scim: false, risk: "low", data: "internal", plan: "Business" },
  { name: "Asana", category: "Project management", website: "asana.com", hue: 4, owner: D.ops, scope: [D.ops, D.mkt, D.people, D.cs, D.fin], adoption: 0.74, utilization: 0.55, unit: 25, platform: 0, commitRatio: 1.19, growth: 0.001, renewalInDays: 5, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.09, sso: true, scim: true, risk: "low", data: "internal", plan: "Business" },
  { name: "Salesforce", category: "CRM", website: "salesforce.com", hue: 0, owner: D.sales, scope: [D.sales, D.cs, D.mkt, D.fin], adoption: 0.85, utilization: 0.88, unit: 165, platform: 4_500, commitRatio: 0.86, growth: 0.007, renewalInDays: 129, termMonths: 36, autoRenew: false, noticeDays: 90, uplift: 0.13, sso: true, scim: true, risk: "high", data: "restricted", plan: "Sales Cloud Enterprise" },
  { name: "Gong", category: "Sales", website: "gong.io", hue: 5, owner: D.sales, scope: [D.sales, D.cs], adoption: 0.79, utilization: 0.74, unit: 132, platform: 2_100, commitRatio: 0.94, growth: 0.005, renewalInDays: 41, termMonths: 12, autoRenew: true, noticeDays: 60, uplift: 0.16, sso: true, scim: true, risk: "high", data: "restricted", plan: "Revenue Intelligence", since: 16 },
  { name: "Outreach", category: "Sales", website: "outreach.io", hue: 1, owner: D.sales, scope: [D.sales], adoption: 0.82, utilization: 0.69, unit: 110, platform: 0, commitRatio: 1.11, growth: -0.002, renewalInDays: 96, termMonths: 12, autoRenew: true, noticeDays: 60, uplift: 0.1, sso: true, scim: false, risk: "medium", data: "confidential", plan: "Standard" },
  { name: "LinkedIn Sales Navigator", category: "Sales intelligence", website: "linkedin.com", hue: 0, owner: D.sales, scope: [D.sales, D.mkt], adoption: 0.61, utilization: 0.46, unit: 135, platform: 0, commitRatio: 1.28, growth: -0.008, renewalInDays: 58, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.07, sso: false, scim: false, risk: "medium", data: "internal", plan: "Advanced" },
  { name: "ZoomInfo", category: "Sales intelligence", website: "zoominfo.com", hue: 1, owner: D.sales, scope: [D.sales, D.mkt], adoption: 0.44, utilization: 0.51, unit: 0, platform: 9_800, commitRatio: 1, growth: 0, renewalInDays: 23, termMonths: 12, autoRenew: true, noticeDays: 60, uplift: 0.19, sso: true, scim: false, risk: "high", data: "confidential", plan: "Advanced+" },
  { name: "Calendly", category: "Sales", website: "calendly.com", hue: 0, owner: D.sales, scope: [D.sales, D.cs, D.people, D.mkt], adoption: 0.72, utilization: 0.62, unit: 12, platform: 0, commitRatio: 1.16, growth: 0.003, renewalInDays: 187, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.05, sso: true, scim: false, risk: "low", data: "internal", plan: "Teams" },
  { name: "HubSpot", category: "Marketing", website: "hubspot.com", hue: 1, owner: D.mkt, scope: [D.mkt, D.sales], adoption: 0.48, utilization: 0.67, unit: 45, platform: 12_400, commitRatio: 1.03, growth: 0.004, renewalInDays: 79, termMonths: 12, autoRenew: true, noticeDays: 60, uplift: 0.17, sso: true, scim: false, risk: "medium", data: "confidential", plan: "Marketing Hub Enterprise" },
  { name: "Braze", category: "Marketing", website: "braze.com", hue: 5, owner: D.mkt, scope: [D.mkt], adoption: 0.4, utilization: 0.8, unit: 0, platform: 16_500, commitRatio: 1, growth: 0, renewalInDays: 244, termMonths: 24, autoRenew: false, noticeDays: 90, uplift: 0.12, sso: true, scim: true, risk: "high", data: "restricted", plan: "Enterprise", since: 10 },
  { name: "Semrush", category: "Marketing", website: "semrush.com", hue: 1, owner: D.mkt, scope: [D.mkt], adoption: 0.33, utilization: 0.38, unit: 130, platform: 0, commitRatio: 1.35, growth: -0.01, renewalInDays: 31, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.08, sso: false, scim: false, risk: "low", data: "public", plan: "Guru" },
  { name: "Zendesk", category: "Support", website: "zendesk.com", hue: 2, owner: D.cs, scope: [D.cs, D.ops], adoption: 0.68, utilization: 0.86, unit: 55, platform: 0, commitRatio: 0.88, growth: 0.006, renewalInDays: 143, termMonths: 12, autoRenew: true, noticeDays: 45, uplift: 0.09, sso: true, scim: true, risk: "medium", data: "confidential", plan: "Suite Professional" },
  { name: "Intercom", category: "Support", website: "intercom.com", hue: 0, owner: D.cs, scope: [D.cs, D.mkt], adoption: 0.35, utilization: 0.44, unit: 74, platform: 3_200, commitRatio: 1.22, growth: -0.005, renewalInDays: 15, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.14, sso: true, scim: false, risk: "medium", data: "confidential", plan: "Advanced" },
  { name: "Datadog", category: "Observability", website: "datadoghq.com", hue: 6, owner: D.eng, scope: [D.eng, D.it, D.data], adoption: 0.58, utilization: 0.81, unit: 0, platform: 41_600, commitRatio: 1, growth: 0, renewalInDays: 67, termMonths: 12, autoRenew: false, noticeDays: 60, uplift: 0.22, sso: true, scim: true, risk: "high", data: "confidential", plan: "Pro + APM commit" },
  { name: "PagerDuty", category: "Observability", website: "pagerduty.com", hue: 3, owner: D.eng, scope: [D.eng, D.it], adoption: 0.62, utilization: 0.77, unit: 41, platform: 0, commitRatio: 0.94, growth: 0.004, renewalInDays: 219, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.06, sso: true, scim: true, risk: "medium", data: "internal", plan: "Business" },
  { name: "Sentry", category: "Engineering", website: "sentry.io", hue: 7, owner: D.eng, scope: [D.eng], adoption: 0.71, utilization: 0.72, unit: 0, platform: 5_900, commitRatio: 1, growth: 0, renewalInDays: 108, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.1, sso: true, scim: false, risk: "medium", data: "confidential", plan: "Business" },
  { name: "CircleCI", category: "Engineering", website: "circleci.com", hue: 6, owner: D.eng, scope: [D.eng], adoption: 0.64, utilization: 0.68, unit: 0, platform: 8_700, commitRatio: 1, growth: 0, renewalInDays: 9, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.15, sso: true, scim: false, risk: "high", data: "restricted", plan: "Scale" },
  { name: "Vercel", category: "Engineering", website: "vercel.com", hue: 0, owner: D.eng, scope: [D.eng, D.design, D.mkt], adoption: 0.31, utilization: 0.59, unit: 20, platform: 2_600, commitRatio: 1.07, growth: 0.006, renewalInDays: 166, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.08, sso: true, scim: false, risk: "medium", data: "confidential", plan: "Enterprise", since: 9 },
  { name: "Cloudflare", category: "Infrastructure", website: "cloudflare.com", hue: 3, owner: D.it, scope: [D.eng, D.it], adoption: 0.22, utilization: 0.9, unit: 0, platform: 14_200, commitRatio: 1, growth: 0, renewalInDays: 231, termMonths: 12, autoRenew: false, noticeDays: 60, uplift: 0.11, sso: true, scim: false, risk: "high", data: "restricted", plan: "Enterprise", since: 11 },
  { name: "Snowflake", category: "Data & analytics", website: "snowflake.com", hue: 0, owner: D.data, scope: [D.data, D.eng, D.fin], adoption: 0.47, utilization: 0.84, unit: 0, platform: 58_400, commitRatio: 1, growth: 0, renewalInDays: 55, termMonths: 24, autoRenew: false, noticeDays: 90, uplift: 0.21, sso: true, scim: true, risk: "high", data: "restricted", plan: "Enterprise capacity" },
  { name: "Looker", category: "Data & analytics", website: "looker.com", hue: 4, owner: D.data, scope: [D.data, D.fin, D.prod, D.ops], adoption: 0.52, utilization: 0.45, unit: 60, platform: 6_400, commitRatio: 1.26, growth: -0.004, renewalInDays: 3, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.13, sso: true, scim: true, risk: "high", data: "restricted", plan: "Standard", since: 17 },
  { name: "Amplitude", category: "Data & analytics", website: "amplitude.com", hue: 0, owner: D.prod, scope: [D.prod, D.data, D.mkt], adoption: 0.56, utilization: 0.49, unit: 0, platform: 11_300, commitRatio: 1, growth: 0, renewalInDays: 132, termMonths: 12, autoRenew: true, noticeDays: 45, uplift: 0.16, sso: true, scim: false, risk: "medium", data: "confidential", plan: "Growth", since: 14 },
  { name: "Segment", category: "Data & analytics", website: "segment.com", hue: 2, owner: D.data, scope: [D.data, D.eng, D.mkt], adoption: 0.28, utilization: 0.66, unit: 0, platform: 13_900, commitRatio: 1, growth: 0, renewalInDays: 44, termMonths: 12, autoRenew: true, noticeDays: 60, uplift: 0.18, sso: true, scim: false, risk: "high", data: "restricted", plan: "Business", since: 8 },
  { name: "Workday", category: "HR & people", website: "workday.com", hue: 1, owner: D.people, scope: [D.people, D.fin, D.legal], adoption: 0.7, utilization: 0.83, unit: 0, platform: 24_800, commitRatio: 1, growth: 0, renewalInDays: 296, termMonths: 36, autoRenew: false, noticeDays: 120, uplift: 0.06, sso: true, scim: true, risk: "high", data: "restricted", plan: "HCM + Financials" },
  { name: "Greenhouse", category: "Recruiting", website: "greenhouse.io", hue: 2, owner: D.people, scope: [D.people, D.eng, D.sales], adoption: 0.18, utilization: 0.57, unit: 0, platform: 7_600, commitRatio: 1, growth: 0, renewalInDays: 176, termMonths: 12, autoRenew: true, noticeDays: 45, uplift: 0.09, sso: true, scim: true, risk: "high", data: "restricted", plan: "Advanced" },
  { name: "Lattice", category: "HR & people", website: "lattice.com", hue: 5, owner: D.people, scope: "all", adoption: 0.94, utilization: 0.36, unit: 11, platform: 0, commitRatio: 1.05, growth: 0.005, renewalInDays: 88, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.07, sso: true, scim: true, risk: "medium", data: "confidential", plan: "Performance + Engagement", since: 12 },
  { name: "Docusign", category: "Legal", website: "docusign.com", hue: 4, owner: D.legal, scope: [D.legal, D.sales, D.fin, D.people], adoption: 0.29, utilization: 0.63, unit: 40, platform: 0, commitRatio: 1.13, growth: 0.002, renewalInDays: 111, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.1, sso: true, scim: false, risk: "medium", data: "confidential", plan: "Business Pro" },
  { name: "Ironclad", category: "Legal", website: "ironcladapp.com", hue: 7, owner: D.legal, scope: [D.legal, D.fin, D.sales], adoption: 0.24, utilization: 0.71, unit: 0, platform: 9_100, commitRatio: 1, growth: 0, renewalInDays: 258, termMonths: 24, autoRenew: false, noticeDays: 90, uplift: 0.08, sso: true, scim: false, risk: "high", data: "restricted", plan: "Enterprise CLM", since: 6 },
  { name: "NetSuite", category: "Finance", website: "netsuite.com", hue: 3, owner: D.fin, scope: [D.fin, D.ops, D.legal], adoption: 0.55, utilization: 0.88, unit: 0, platform: 19_700, commitRatio: 1, growth: 0, renewalInDays: 71, termMonths: 36, autoRenew: false, noticeDays: 90, uplift: 0.19, sso: true, scim: false, risk: "high", data: "restricted", plan: "ERP" },
  { name: "Ramp", category: "Finance", website: "ramp.com", hue: 3, owner: D.fin, scope: [D.fin, D.ops, D.it, D.people], adoption: 0.62, utilization: 0.75, unit: 0, platform: 0, commitRatio: 1, growth: 0, renewalInDays: 289, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0, sso: true, scim: true, risk: "medium", data: "restricted", plan: "Plus (bundled)" },
  { name: "Dropbox", category: "Storage", website: "dropbox.com", hue: 0, owner: D.ops, scope: [D.ops, D.design, D.mkt, D.legal], adoption: 0.38, utilization: 0.22, unit: 20, platform: 0, commitRatio: 1.51, growth: -0.012, renewalInDays: 7, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.04, sso: false, scim: false, risk: "medium", data: "confidential", plan: "Business Advanced" },
  { name: "Grammarly", category: "Productivity", website: "grammarly.com", hue: 2, owner: D.it, scope: "all", adoption: 0.44, utilization: 0.34, unit: 15, platform: 0, commitRatio: 1.33, growth: -0.007, renewalInDays: 36, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.05, sso: false, scim: false, risk: "medium", data: "confidential", plan: "Business", since: 13 },
  { name: "Loom", category: "Collaboration", website: "loom.com", hue: 4, owner: D.prod, scope: [D.prod, D.design, D.eng, D.cs, D.mkt], adoption: 0.51, utilization: 0.29, unit: 13, platform: 0, commitRatio: 1.44, growth: -0.009, renewalInDays: 21, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.06, sso: true, scim: false, risk: "low", data: "internal", plan: "Business", since: 18 },
  { name: "Twilio", category: "Communications", website: "twilio.com", hue: 7, owner: D.eng, scope: [D.eng, D.cs], adoption: 0.12, utilization: 0.95, unit: 0, platform: 10_400, commitRatio: 1, growth: 0, renewalInDays: 194, termMonths: 12, autoRenew: true, noticeDays: 30, uplift: 0.09, sso: true, scim: false, risk: "medium", data: "confidential", plan: "Committed use" },
];

export type ShadowSeed = {
  app: string;
  category: string;
  source: "expense" | "sso" | "network" | "oauth_grant";
  users: number;
  monthlySpend: number;
  risk: number;
  daysKnown: number;
  scopes: string;
  dept: string;
  overlaps?: string;
  status: "new" | "reviewing" | "approved" | "blocked" | "consolidated";
};

export const SHADOW_IT: ShadowSeed[] = [
  { app: "Airtable", category: "Project management", source: "expense", users: 34, monthlySpend: 680, risk: 46, daysKnown: 96, scopes: "Google Drive read/write", dept: D.mkt, overlaps: "Asana", status: "reviewing" },
  { app: "ChatGPT Team", category: "AI assistant", source: "expense", users: 61, monthlySpend: 1_830, risk: 78, daysKnown: 142, scopes: "No SSO, no DLP, no retention control", dept: D.eng, status: "reviewing" },
  { app: "Claude Pro (personal cards)", category: "AI assistant", source: "expense", users: 23, monthlySpend: 460, risk: 62, daysKnown: 74, scopes: "Reimbursed individually, no tenancy", dept: D.prod, status: "new" },
  { app: "Typeform", category: "Forms", source: "oauth_grant", users: 12, monthlySpend: 99, risk: 38, daysKnown: 210, scopes: "Contact data export", dept: D.mkt, status: "approved" },
  { app: "Lucidchart", category: "Design", source: "sso", users: 27, monthlySpend: 405, risk: 31, daysKnown: 168, scopes: "Directory read", dept: D.eng, overlaps: "Miro", status: "consolidated" },
  { app: "Zapier", category: "Automation", source: "oauth_grant", users: 18, monthlySpend: 599, risk: 71, daysKnown: 121, scopes: "Salesforce read/write, Slack post", dept: D.ops, status: "reviewing" },
  { app: "Otter.ai", category: "AI assistant", source: "oauth_grant", users: 44, monthlySpend: 748, risk: 84, daysKnown: 58, scopes: "Calendar read, meeting audio capture", dept: D.sales, overlaps: "Gong", status: "new" },
  { app: "Canva", category: "Design", source: "expense", users: 39, monthlySpend: 585, risk: 24, daysKnown: 240, scopes: "Brand asset storage", dept: D.mkt, overlaps: "Figma", status: "approved" },
  { app: "Descript", category: "Design", source: "expense", users: 8, monthlySpend: 192, risk: 29, daysKnown: 63, scopes: "Media upload", dept: D.mkt, overlaps: "Loom", status: "new" },
  { app: "Retool", category: "Engineering", source: "network", users: 15, monthlySpend: 1_050, risk: 74, daysKnown: 187, scopes: "Production database connection", dept: D.eng, status: "reviewing" },
  { app: "Superhuman", category: "Productivity", source: "expense", users: 11, monthlySpend: 330, risk: 41, daysKnown: 145, scopes: "Full mailbox access", dept: D.sales, status: "new" },
  { app: "Pitch", category: "Productivity", source: "sso", users: 9, monthlySpend: 180, risk: 22, daysKnown: 92, scopes: "Directory read", dept: D.prod, status: "blocked" },
  { app: "Mixpanel", category: "Data & analytics", source: "network", users: 7, monthlySpend: 840, risk: 57, daysKnown: 51, scopes: "Product event stream", dept: D.prod, overlaps: "Amplitude", status: "new" },
  { app: "Deel", category: "HR & people", source: "expense", users: 4, monthlySpend: 1_160, risk: 66, daysKnown: 133, scopes: "Contractor PII, payment rails", dept: D.people, status: "reviewing" },
  { app: "Perplexity Enterprise", category: "AI assistant", source: "expense", users: 19, monthlySpend: 760, risk: 59, daysKnown: 41, scopes: "No SSO enforcement", dept: D.data, status: "new" },
];

export const FIRST_NAMES = "Ava Noah Mia Liam Zoe Ethan Iris Kai Nora Owen Priya Rafael Sana Theo Uma Victor Wren Yusuf Chloe Dmitri Elena Farid Grace Hugo Ines Jonas Keira Lucas Maya Nadia Omar Paloma Quinn Rosa Samir Talia Ugo Vera Wei Xenia Yara Zane Alice Bruno Camila Dara Eli Fatima Gideon Hana Idris Jade Kofi Lena Mateo Nia Oskar Petra Rin Soren Tessa Ulla Vikram Willa Xiomara Yannick Zara Anders Bea Cyrus Dahlia Emeka Freya Gustav Hela Ivo Juno Kaito Lior Marta Nils Oona Pablo Rhea Stig Tove Ursula Viggo Wanda Xu Yosef Zelda".split(" ");
export const LAST_NAMES = "Alvarez Baptiste Chen Dahl Eriksen Ferrante Gupta Haddad Iversen Jansen Kowalski Lindqvist Moreau Nakamura Osei Petrov Quintero Rossi Suzuki Tanaka Ueda Vargas Whitfield Xiao Yilmaz Zhang Abara Bellini Castellanos Duarte Egwu Fournier Granger Hollis Ibarra Jeong Kaur Larsen Mbeki Novak Okonkwo Pham Rahman Silva Thorne Ullah Voss Weaver Yamada Zeidan".split(" ");

export const TITLES: Record<string, string[]> = {
  Engineering: ["Software Engineer", "Senior Software Engineer", "Staff Engineer", "Engineering Manager", "Site Reliability Engineer", "QA Engineer"],
  Operations: ["Operations Associate", "Production Planner", "Supply Chain Analyst", "Operations Manager", "Field Technician"],
  Sales: ["Account Executive", "Senior Account Executive", "Sales Development Rep", "Sales Engineer", "Regional Sales Director"],
  "Customer Success": ["Customer Success Manager", "Support Engineer", "Onboarding Specialist", "Renewals Manager"],
  Marketing: ["Product Marketing Manager", "Demand Gen Manager", "Content Strategist", "Brand Designer", "Marketing Ops Analyst"],
  Product: ["Product Manager", "Senior Product Manager", "Technical Program Manager", "Product Analyst"],
  Design: ["Product Designer", "Senior Product Designer", "Design Systems Lead", "UX Researcher"],
  Finance: ["Financial Analyst", "Controller", "Accounts Payable Specialist", "FP&A Manager", "Procurement Analyst"],
  Data: ["Data Engineer", "Analytics Engineer", "Data Scientist", "BI Analyst"],
  IT: ["IT Support Specialist", "Systems Administrator", "Security Engineer", "IT Asset Manager"],
  People: ["Recruiter", "People Partner", "People Ops Coordinator", "Total Rewards Analyst"],
  Legal: ["Corporate Counsel", "Contracts Manager", "Compliance Analyst", "Paralegal"],
};

/** Accounts created for the demo, one per role. */
export const DEMO_USERS = [
  { email: "dana.reyes@arclight.systems", name: "Dana Reyes", title: "VP, IT & Security", role: "admin" as const, dept: D.it },
  { email: "marcus.lin@arclight.systems", name: "Marcus Lin", title: "Director of Finance", role: "finance" as const, dept: D.fin },
  { email: "priya.nandan@arclight.systems", name: "Priya Nandan", title: "IT Asset Manager", role: "it" as const, dept: D.it },
  { email: "sofia.marchetti@arclight.systems", name: "Sofia Marchetti", title: "VP, Sales", role: "dept_owner" as const, dept: D.sales },
  { email: "tom.okafor@arclight.systems", name: "Tom Okafor", title: "Board Observer", role: "viewer" as const, dept: D.fin },
];

export const DEMO_PASSWORD = "Sightline!Demo2026";
