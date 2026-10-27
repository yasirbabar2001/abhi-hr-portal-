import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/store";
import { MASTER_TYPES, type MasterItem } from "@/lib/types";
import { Badge, Card, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { masterUsage } from "@/lib/admin/master";
import { deleteItem, saveItem, toggleItem } from "./actions";

export default async function MasterDataPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const d = db();
  const current = MASTER_TYPES.find((t) => t.type === sp.type) ?? MASTER_TYPES[0]!;
  const items = d.master.filter((m) => m.type === current.type).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const usage = masterUsage(d);
  const editing = sp.edit ? items.find((m) => m.id === sp.edit) : undefined;
  const base = `/admin/master-data?type=${current.type}`;

  return (
    <div>
      <PageHeader title="Master data" subtitle="The lists used across the portal. Values in use can be renamed or deactivated, but not deleted, so history stays intact." />
      <Flash msg={sp.msg} err={sp.err} />
      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Lists">
          {MASTER_TYPES.map((t) => (
            <Link
              key={t.type}
              href={`/admin/master-data?type=${t.type}`}
              className={`flex items-center justify-between whitespace-nowrap rounded-lg px-3 py-2 text-sm ${t.type === current.type ? "bg-brand text-white" : "bg-surface text-ink hover:bg-brand-soft"}`}
            >
              {t.label}
              <span className="ml-2 text-xs opacity-70">{d.master.filter((m) => m.type === t.type).length}</span>
            </Link>
          ))}
        </nav>
        <div className="space-y-4">
          <Card
            title={current.label}
            actions={!sp.new && !editing && <Link href={`${base}&new=1`} className="font-medium text-brand">+ Add</Link>}
          >
            <p className="-mt-1 mb-3 text-xs text-muted">{current.hint}</p>
            {(sp.new || editing) && <ItemForm type={current.type} item={editing} cancel={base} />}
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Order</th><th>Code</th><th>Name</th><th>Extra</th><th>Used</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {items.map((m) => {
                    const used = usage.get(m.id) ?? 0;
                    return (
                      <tr key={m.id} className={m.active ? "" : "opacity-60"}>
                        <td className="tabular-nums text-muted">{m.order}</td>
                        <td><code className="text-xs">{m.code}</code></td>
                        <td className="font-medium">{m.name}</td>
                        <td className="text-xs text-muted">{m.meta ? Object.entries(m.meta).map(([k, v]) => `${k}=${k === "region" ? d.master.find((x) => x.id === v)?.name ?? v : v}`).join(", ") : "—"}</td>
                        <td className="tabular-nums">{used}</td>
                        <td>{m.active ? <Badge tone="ok">Active</Badge> : <Badge>Inactive</Badge>}</td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <Link href={`${base}&edit=${m.id}`} className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-soft">Edit</Link>
                            <form action={toggleItem}>
                              <input type="hidden" name="id" value={m.id} />
                              <SubmitButton size="sm" variant="secondary">{m.active ? "Deactivate" : "Activate"}</SubmitButton>
                            </form>
                            {used === 0 && (
                              <form action={deleteItem}>
                                <input type="hidden" name="id" value={m.id} />
                                <SubmitButton size="sm" variant="ghost" confirm={`Delete “${m.name}”? It is not used anywhere.`}>Delete</SubmitButton>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">No values yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ItemForm({ type, item, cancel }: { type: string; item?: MasterItem; cancel: string }) {
  return (
    <form action={saveItem} className="mb-4 grid gap-3 rounded-lg border border-line bg-paper p-4 sm:grid-cols-4">
      <input type="hidden" name="type" value={type} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <label><span className="label">Code</span><input name="code" defaultValue={item?.code} required className="input uppercase" maxLength={16} /></label>
      <label className="sm:col-span-2"><span className="label">Name</span><input name="name" defaultValue={item?.name} required className="input" /></label>
      <label><span className="label">Display order</span><input name="order" type="number" defaultValue={item?.order ?? 0} className="input" /></label>
      <label className="sm:col-span-3">
        <span className="label">Extra attributes (optional)</span>
        <textarea name="meta" defaultValue={item?.meta ? Object.entries(item.meta).map(([k, v]) => `${k}=${v}`).join("\n") : ""} className="input min-h-16 font-mono text-xs" placeholder={"one per line, e.g.\ncity=Karachi\nrank=3"} />
      </label>
      <div className="flex flex-col justify-end gap-2">
        {item && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={item.active} /> Active</label>
        )}
        <div className="flex gap-2">
          <SubmitButton>{item ? "Save" : "Add"}</SubmitButton>
          <Link href={cancel} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink">Cancel</Link>
        </div>
      </div>
    </form>
  );
}
