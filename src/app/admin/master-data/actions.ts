"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db, mutate, uid } from "@/lib/store";
import { MASTER_TYPES, type MasterType } from "@/lib/types";
import { masterUsage, parseMeta } from "@/lib/admin/master";

const enc = encodeURIComponent;

export async function saveItem(form: FormData) {
  const actor = await requireAdmin();
  const type = String(form.get("type")) as MasterType;
  if (!MASTER_TYPES.some((t) => t.type === type)) redirect("/admin/master-data");
  const id = String(form.get("id") ?? "");
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const name = String(form.get("name") ?? "").trim();
  const order = Number(form.get("order") ?? 0) || 0;
  const meta = parseMeta(String(form.get("meta") ?? ""));
  const back = `/admin/master-data?type=${type}`;
  if (!code || !name) redirect(`${back}&err=${enc("Code and name are both required.")}${id ? `&edit=${id}` : "&new=1"}`);
  if (db().master.some((m) => m.type === type && m.code === code && m.id !== id))
    redirect(`${back}&err=${enc(`Code ${code} is already used in this list.`)}${id ? `&edit=${id}` : "&new=1"}`);
  mutate((d) => {
    if (id) {
      const item = d.master.find((m) => m.id === id);
      if (!item) return;
      const before = { ...item };
      Object.assign(item, { code, name, order, meta, active: form.get("active") === "on" });
      audit(d, actor, "master.update", "master", id, `${actor.name} updated ${type.replace(/_/g, " ")} “${name}”`, { before, after: { ...item } });
    } else {
      const item = { id: uid("m_"), type, code, name, order, meta, active: true };
      d.master.push(item);
      audit(d, actor, "master.create", "master", item.id, `${actor.name} added ${type.replace(/_/g, " ")} “${name}”`, { after: item });
    }
  });
  redirect(`${back}&msg=${enc("Saved.")}`);
}

export async function toggleItem(form: FormData) {
  const actor = await requireAdmin();
  const id = String(form.get("id"));
  let type = "";
  mutate((d) => {
    const item = d.master.find((m) => m.id === id);
    if (!item) return;
    type = item.type;
    item.active = !item.active;
    audit(d, actor, item.active ? "master.activate" : "master.deactivate", "master", id, `${actor.name} ${item.active ? "reactivated" : "deactivated"} “${item.name}”`, {
      before: { active: !item.active },
      after: { active: item.active },
    });
  });
  redirect(`/admin/master-data?type=${type}&msg=${enc("Updated.")}`);
}

export async function deleteItem(form: FormData) {
  const actor = await requireAdmin();
  const id = String(form.get("id"));
  const d0 = db();
  const item = d0.master.find((m) => m.id === id);
  if (!item) redirect("/admin/master-data");
  if ((masterUsage(d0).get(id) ?? 0) > 0)
    redirect(`/admin/master-data?type=${item!.type}&err=${enc("This value is in use, so it can only be deactivated.")}`);
  mutate((d) => {
    d.master = d.master.filter((m) => m.id !== id);
    audit(d, actor, "master.delete", "master", id, `${actor.name} deleted unused ${item!.type.replace(/_/g, " ")} “${item!.name}”`, { before: item });
  });
  redirect(`/admin/master-data?type=${item!.type}&msg=${enc("Deleted.")}`);
}
