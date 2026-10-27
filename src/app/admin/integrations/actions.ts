"use server";
import crypto from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { mutate } from "@/lib/store";
import { parseFieldMap } from "@/lib/integrations/employee-api";
import { syncEmployees, testConnection, type SyncResult, type TestResult } from "@/lib/integrations/sync";
import { db } from "@/lib/store";

const back = (q: string) => redirect(`/admin/integrations?${q}`);

export async function saveApiSettings(form: FormData) {
  const user = await requireAdmin();
  const url = String(form.get("url") ?? "").trim();
  if (url && !/^https?:\/\//i.test(url)) back("err=" + encodeURIComponent("The API address must start with http:// or https://"));
  const { map, errors } = parseFieldMap(String(form.get("fieldMap") ?? ""));
  if (errors.length) back("err=" + encodeURIComponent("Field mapping: " + errors.join(" ")));
  const newValue = String(form.get("authValue") ?? "");
  const hours = Math.max(0, Math.min(168, Number(form.get("autoSyncHours") ?? 0) || 0));
  mutate((d) => {
    const api = d.settings.employeeApi;
    const before = { ...api };
    api.url = url;
    api.authHeader = String(form.get("authHeader") ?? "").trim() || "Authorization";
    if (form.get("clearAuth")) api.authValue = "";
    else if (newValue) api.authValue = newValue;
    api.fieldMap = map;
    api.autoSyncHours = hours;
    audit(d, user, "integration.update", "integration", "employee-api", "Updated the employee API settings", { before, after: { ...api } });
  });
  back("msg=" + encodeURIComponent("Settings saved."));
}

export async function applyDemoEndpoint() {
  const user = await requireAdmin();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  mutate((d) => {
    const api = d.settings.employeeApi;
    api.url = `${proto}://${host}/api/mock/hris/employees`;
    api.authHeader = "Authorization";
    api.authValue = "Bearer demo-token";
    audit(d, user, "integration.update", "integration", "employee-api", "Pointed the employee API at the built-in demo HRIS");
  });
  back("msg=" + encodeURIComponent("Demo HRIS endpoint filled in. Now test the connection, then sync."));
}

export async function testAction(): Promise<TestResult> {
  await requireAdmin();
  return testConnection(db().settings.employeeApi);
}

export async function syncAction(_prev: SyncResult | null, form: FormData): Promise<SyncResult> {
  const user = await requireAdmin();
  return syncEmployees(user, { deactivateMissing: !!form.get("deactivateMissing") });
}

export async function rotateKey() {
  const user = await requireAdmin();
  mutate((d) => {
    d.settings.employeeApi.outboundApiKey = crypto.randomBytes(18).toString("base64url");
    audit(d, user, "integration.rotate_key", "integration", "outbound-api", "Rotated the outbound API key (old key stops working now)");
  });
  back("msg=" + encodeURIComponent("New API key created. Update every system that calls the portal."));
}
