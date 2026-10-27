import "server-only";
import { db } from "../store";
import { SYSTEM } from "../audit";
import { syncEmployees } from "../integrations/sync";

let running = false;

/** Start a background sync when automatic sync is on and the last run is older than the interval. */
export function maybeAutoSync() {
  const api = db().settings.employeeApi;
  if (!api.url || !api.autoSyncHours || running) return;
  const last = api.lastSyncAt ? Date.parse(api.lastSyncAt) : 0;
  if (Date.now() - last < api.autoSyncHours * 3600_000) return;
  running = true;
  syncEmployees({ id: SYSTEM.id, name: "Automatic sync", role: "system" }, { deactivateMissing: false })
    .catch(() => undefined)
    .finally(() => {
      running = false;
    });
}
