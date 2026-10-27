import { NextResponse } from "next/server";

// Demo stand-in for the bank's core HR system (HRIS). It answers in the source
// format of the default field mapping so Admin → Employee API can be tried end to end.
// Requires: Authorization: Bearer demo-token. Pages of 15 with a `next` link.

const PAGE_SIZE = 15;
const FIRST = ["Ahmed", "Ayesha", "Bilal", "Danish", "Erum", "Fahad", "Ghazala", "Haris", "Iram", "Jawad", "Khadija", "Luqman", "Mehwish", "Nabeel", "Omer", "Palwasha", "Qasim", "Rida", "Salman", "Tahira"];
const LAST = ["Khan", "Malik", "Hussain", "Raza", "Sheikh", "Chaudhry", "Abbasi", "Mirza", "Baig", "Akhtar", "Iqbal", "Shah"];
const DEPTS: [string, string[], string][] = [
  ["RET", ["CSO", "BM"], "OG-III"],
  ["MFO", ["RO"], "OG-III"],
  ["CRD", ["CO", "RA"], "OG-II"],
  ["DIG", ["PM"], "AVP"],
  ["IT", ["SE"], "OG-I"],
  ["FIN", ["ACC"], "OG-II"],
  ["HR", ["HRBP"], "OG-I"],
  ["CMP", ["CMO"], "OG-I"],
  ["OPS", ["OPA"], "OG-III"], // codes not yet in master data: the sync creates them
];
const BRANCHES = ["KHI-HO", "KHI-CLF", "LHR", "ISB", "FSD", "MUX", "PEW", "HYD", "SKT"];
const STATUSES = ["Permanent", "Permanent", "Permanent", "On Probation", "Contract", "Permanent", "Resigned"];

function employees() {
  const out = [];
  for (let i = 0; i < 42; i++) {
    const [dept, desigs, grade] = DEPTS[i % DEPTS.length]!;
    const name = `${FIRST[(i * 7) % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`;
    // The first 20 numbers match records already in the demo master, so a sync updates them.
    const code = i < 20 ? `ABHI-${2019 + (i % 7)}-${String(10001 + i).slice(1)}` : `ABHI-HRIS-${String(5000 + i)}`;
    const day = String(1 + ((i * 3) % 28)).padStart(2, "0");
    const month = String(1 + (i % 12)).padStart(2, "0");
    out.push({
      employee_code: code,
      full_name: name,
      official_email: `${name.toLowerCase().replace(/\s+/g, ".")}.${i}@abhi.com.pk`,
      mobile: `0300${String(1000000 + i * 7919).slice(0, 7)}`,
      cnic: `42101-${String(1000000 + i * 104729).slice(0, 7)}-${i % 10}`,
      department_code: dept,
      branch_code: dept === "RET" || dept === "MFO" || dept === "OPS" ? BRANCHES[i % BRANCHES.length] : "KHI-HO",
      designation_code: desigs[i % desigs.length],
      grade_code: grade,
      date_of_joining: `${day}/${month}/${2016 + (i % 9)}`,
      employment_status: STATUSES[i % STATUSES.length],
    });
  }
  return out;
}

export function GET(req: Request) {
  if (req.headers.get("authorization") !== "Bearer demo-token") {
    return NextResponse.json({ error: "unauthorised", hint: "Send Authorization: Bearer demo-token" }, { status: 401 });
  }
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const all = employees();
  const data = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasMore = page * PAGE_SIZE < all.length;
  const next = new URL(url);
  next.searchParams.set("page", String(page + 1));
  return NextResponse.json({ data, page, total: all.length, next: hasMore ? next.toString() : null });
}
