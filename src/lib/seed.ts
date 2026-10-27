import crypto from "node:crypto";
import type {
  Application,
  CandidateProfile,
  Db,
  Employee,
  HeadcountBudget,
  Interview,
  JobDescription,
  JobPosting,
  MasterItem,
  MasterType,
  OrientationModule,
  Requisition,
  Scorecard,
  Stage,
  Survey,
  User,
} from "./types";
import { STAGES } from "./types";
import { screen } from "./screening";

// Demo data so every screen has something meaningful on first run.
// Demo password for every seeded account: Abhi@2026

export const DEMO_PASSWORD = "Abhi@2026";

function hash(password: string) {
  const salt = "demo-salt-" + password.length;
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 32).toString("hex")}`;
}

// Deterministic pseudo-random numbers so the seed is the same each time.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildSeed(): Db {
  const rand = rng(20261027);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();
  const daysAhead = (n: number, hour = 11) => {
    const dt = new Date(now + n * 86_400_000);
    dt.setUTCHours(hour - 5, 0, 0, 0); // hour in Karachi time
    return dt.toISOString();
  };
  let idn = 0;
  const id = (p: string) => `${p}${(++idn).toString(36).padStart(5, "0")}`;

  // ---------- master data ----------
  const master: MasterItem[] = [];
  const m = (type: MasterType, code: string, name: string, meta?: Record<string, string>) => {
    const item: MasterItem = { id: id("m_"), type, code, name, active: true, order: master.filter((x) => x.type === type).length, meta };
    master.push(item);
    return item;
  };
  const regions = {
    south: m("region", "SOUTH", "South"),
    central: m("region", "CENTRAL", "Central"),
    north: m("region", "NORTH", "North"),
  };
  const br = {
    khi: m("branch", "KHI-HO", "Karachi Head Office", { region: regions.south.id, city: "Karachi" }),
    khi2: m("branch", "KHI-CLF", "Karachi Clifton", { region: regions.south.id, city: "Karachi" }),
    hyd: m("branch", "HYD", "Hyderabad", { region: regions.south.id, city: "Hyderabad" }),
    lhr: m("branch", "LHR", "Lahore Gulberg", { region: regions.central.id, city: "Lahore" }),
    fsd: m("branch", "FSD", "Faisalabad", { region: regions.central.id, city: "Faisalabad" }),
    mux: m("branch", "MUX", "Multan", { region: regions.central.id, city: "Multan" }),
    isb: m("branch", "ISB", "Islamabad Blue Area", { region: regions.north.id, city: "Islamabad" }),
    pew: m("branch", "PEW", "Peshawar", { region: regions.north.id, city: "Peshawar" }),
  };
  const branches = Object.values(br);
  const dep = {
    ret: m("department", "RET", "Retail & Branch Banking"),
    mfo: m("department", "MFO", "Microfinance Operations"),
    crd: m("department", "CRD", "Credit & Risk"),
    dig: m("department", "DIG", "Digital Banking & Product"),
    it: m("department", "IT", "Information Technology"),
    fin: m("department", "FIN", "Finance"),
    hr: m("department", "HR", "Human Resources"),
    cmp: m("department", "CMP", "Compliance & AML"),
    aud: m("department", "AUD", "Internal Audit"),
    trs: m("department", "TRS", "Treasury"),
  };

  const gr = {
    og3: m("grade", "OG-III", "Officer Grade III"),
    og2: m("grade", "OG-II", "Officer Grade II"),
    og1: m("grade", "OG-I", "Officer Grade I"),
    avp: m("grade", "AVP", "Assistant Vice President"),
    vp: m("grade", "VP", "Vice President"),
    svp: m("grade", "SVP", "Senior Vice President"),
  };
  const ds = {
    cso: m("designation", "CSO", "Customer Service Officer"),
    ro: m("designation", "RO", "Relationship Officer"),
    co: m("designation", "CO", "Credit Officer"),
    bm: m("designation", "BM", "Branch Manager"),
    ra: m("designation", "RA", "Risk Analyst"),
    se: m("designation", "SE", "Software Engineer"),
    pm: m("designation", "PM", "Digital Product Manager"),
    cmo: m("designation", "CMO", "Compliance Officer"),
    hrbp: m("designation", "HRBP", "HR Business Partner"),
    acc: m("designation", "ACC", "Accountant"),
    aud: m("designation", "AUD", "Internal Auditor"),
    dl: m("designation", "DL", "Treasury Dealer"),
  };
  const et = {
    perm: m("employment_type", "PERM", "Permanent"),
    cont: m("employment_type", "CONT", "Contract"),
    intern: m("employment_type", "INT", "Internship"),
  };
  const src = {
    site: m("source", "SITE", "Careers website"),
    li: m("source", "LI", "LinkedIn"),
    rozee: m("source", "ROZEE", "Rozee.pk"),
    ref: m("source", "REF", "Employee referral"),
    uni: m("source", "UNI", "University / campus drive"),
    agency: m("source", "AGY", "Recruitment agency"),
    internal: m("source", "INT", "Internal mobility"),
  };
  const sources = Object.values(src);
  m("rejection_reason", "EXP", "Insufficient experience");
  m("rejection_reason", "QUAL", "Qualification does not meet requirement");
  m("rejection_reason", "KO", "Did not meet a knock-out requirement");
  m("rejection_reason", "INT", "Interview performance");
  m("rejection_reason", "SAL", "Salary expectation outside range");
  m("rejection_reason", "VER", "Verification not cleared");
  m("rejection_reason", "WD", "Candidate withdrew");
  for (const c of [
    "Customer focus",
    "Integrity & ethics",
    "Communication",
    "Problem solving",
    "Teamwork",
    "Role knowledge",
    "Digital mindset",
  ])
    m("competency", c.slice(0, 4).toUpperCase(), c);
  for (const [code, name] of [
    ["CNIC", "CNIC (both sides)"],
    ["EDU", "Educational certificates"],
    ["EXP", "Experience letters"],
    ["PHOTO", "Passport-size photograph"],
    ["BANK", "Bank account details"],
    ["MED", "Medical fitness certificate"],
    ["NOK", "Next of kin form"],
  ] as const)
    m("document_type", code, name);
  const ql = {
    inter: m("qualification", "INTER", "Intermediate (HSSC)", { rank: "1" }),
    bach: m("qualification", "BACH", "Bachelor's (14 years)", { rank: "2" }),
    bach16: m("qualification", "BACH16", "Bachelor's (16 years)", { rank: "3" }),
    mast: m("qualification", "MAST", "Master's / MBA", { rank: "4" }),
    prof: m("qualification", "PROF", "Professional (ACCA / CA / CFA)", { rank: "5" }),
  };

  // ---------- users ----------
  const pw = hash(DEMO_PASSWORD);
  const users: User[] = [];
  const u = (email: string, name: string, role: User["role"], title?: string, departmentId?: string) => {
    const user: User = {
      id: id("u_"),
      email,
      name,
      role,
      passwordHash: pw,
      active: true,
      title,
      departmentId,
      createdAt: daysAgo(200),
    };
    users.push(user);
    return user;
  };
  const admin = u("admin@abhi.com.pk", "Sana Qureshi", "admin", "HRIS Administrator", dep.hr.id);
  const hr1 = u("hr@abhi.com.pk", "Ayesha Siddiqui", "hr", "Talent Acquisition Lead", dep.hr.id);
  const hr2 = u("recruiter@abhi.com.pk", "Bilal Ahmed", "hr", "Recruitment Specialist", dep.hr.id);
  const mgr1 = u("manager@abhi.com.pk", "Usman Tariq", "hiring", "Head of Digital Banking", dep.dig.id);
  const mgr2 = u("credit.head@abhi.com.pk", "Farah Naz", "hiring", "Head of Credit & Risk", dep.crd.id);
  const mgr3 = u("ops.head@abhi.com.pk", "Kamran Javed", "hiring", "Regional Head Operations", dep.mfo.id);

  // ---------- employees (as if synced from the core HR system) ----------
  const first = ["Ali", "Hassan", "Zainab", "Fatima", "Omar", "Hira", "Saad", "Maryam", "Imran", "Nida", "Faisal", "Rabia", "Junaid", "Sara", "Adeel", "Mahnoor", "Waqas", "Iqra", "Hamza", "Amna", "Shoaib", "Kiran", "Asad", "Sobia", "Noman", "Areeba"];
  const last = ["Khan", "Malik", "Hussain", "Raza", "Sheikh", "Chaudhry", "Butt", "Abbasi", "Mirza", "Qureshi", "Siddiqui", "Baig", "Rana", "Akhtar", "Iqbal", "Shah"];
  const employees: Employee[] = [];
  const deptDesig: [MasterItem, MasterItem, MasterItem][] = [
    [dep.ret, ds.cso, gr.og3],
    [dep.ret, ds.bm, gr.avp],
    [dep.mfo, ds.ro, gr.og3],
    [dep.mfo, ds.ro, gr.og2],
    [dep.crd, ds.co, gr.og2],
    [dep.crd, ds.ra, gr.og1],
    [dep.dig, ds.pm, gr.avp],
    [dep.it, ds.se, gr.og1],
    [dep.fin, ds.acc, gr.og2],
    [dep.hr, ds.hrbp, gr.og1],
    [dep.cmp, ds.cmo, gr.og1],
    [dep.aud, ds.aud, gr.og1],
    [dep.trs, ds.dl, gr.avp],
  ];
  for (let i = 0; i < 84; i++) {
    const [d, des, g] = pick(deptDesig);
    const name = `${pick(first)} ${pick(last)}`;
    const joined = daysAgo(30 + Math.floor(rand() * 2400));
    const exited = i % 17 === 0;
    const probation = !exited && i % 9 === 0;
    employees.push({
      id: id("e_"),
      employeeNo: `ABHI-${2019 + (i % 7)}-${String(10001 + i).slice(1)}`,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}${i}@abhi.com.pk`,
      phone: `03${Math.floor(rand() * 9)}${String(Math.floor(rand() * 1e8)).padStart(8, "0")}`,
      cnic: `${35000 + Math.floor(rand() * 9999)}-${String(Math.floor(rand() * 1e7)).padStart(7, "0")}-${Math.floor(rand() * 9)}`,
      gender: i % 3 === 0 ? "female" : "male",
      departmentId: d.id,
      branchId: d.id === dep.ret.id || d.id === dep.mfo.id ? pick(branches).id : br.khi.id,
      designationId: des.id,
      gradeId: g.id,
      employmentTypeId: i % 11 === 0 ? et.cont.id : et.perm.id,
      joiningDate: joined,
      employmentStatus: exited ? "resigned" : probation ? "probation" : i % 11 === 0 ? "contract" : "confirmed",
      active: !exited,
      basicSalary: 60000 + Math.floor(rand() * 240000),
      source: "api",
      lastSyncedAt: daysAgo(1),
      exitDate: exited ? daysAgo(Math.floor(rand() * 120)) : undefined,
      createdAt: joined,
      updatedAt: daysAgo(1),
    });
  }

  // ---------- headcount budgets FY 2026-27 ----------
  const fy = "2026-27";
  const budgets: HeadcountBudget[] = [];
  const budgetFor = (d: MasterItem, des: MasterItem, g: MasterItem, approved: number, cost: number, branchId?: string) => {
    const b: HeadcountBudget = {
      id: id("b_"),
      fiscalYear: fy,
      departmentId: d.id,
      branchId,
      designationId: des.id,
      gradeId: g.id,
      // approved = people already in post + planned growth
      approvedHeadcount: employees.filter((e) => e.active && e.departmentId === d.id && e.designationId === des.id).length + approved,
      annualCostPerHead: cost,
      createdBy: hr1.id,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(40),
    };
    budgets.push(b);
    return b;
  };
  const bRo = budgetFor(dep.mfo, ds.ro, gr.og3, 8, 1_450_000);
  const bCso = budgetFor(dep.ret, ds.cso, gr.og3, 4, 1_250_000);
  const bCo = budgetFor(dep.crd, ds.co, gr.og2, 2, 2_100_000);
  const bRa = budgetFor(dep.crd, ds.ra, gr.og1, 2, 2_900_000);
  const bSe = budgetFor(dep.it, ds.se, gr.og1, 4, 3_600_000);
  const bPm = budgetFor(dep.dig, ds.pm, gr.avp, 2, 5_400_000);
  budgetFor(dep.cmp, ds.cmo, gr.og1, 1, 2_700_000);
  budgetFor(dep.fin, ds.acc, gr.og2, 1, 2_000_000);
  budgetFor(dep.hr, ds.hrbp, gr.og1, 1, 2_600_000);
  budgetFor(dep.aud, ds.aud, gr.og1, 0, 2_800_000);
  budgetFor(dep.ret, ds.bm, gr.avp, 2, 4_800_000);
  budgetFor(dep.trs, ds.dl, gr.avp, 0, 5_200_000);

  // ---------- job descriptions ----------
  const jds: JobDescription[] = [];
  const jd = (
    title: string,
    d: MasterItem,
    des: MasterItem,
    g: MasterItem,
    reportsTo: string,
    summary: string,
    responsibilities: string[],
    requirements: string[],
    keywords: string[],
    minExp: number,
    q: MasterItem,
  ) => {
    const j: JobDescription = {
      id: id("jd_"),
      code: `JD-${des.code}-${String(jds.length + 1).padStart(3, "0")}`,
      title,
      departmentId: d.id,
      designationId: des.id,
      gradeId: g.id,
      reportsTo,
      summary,
      responsibilities,
      requirements,
      competencies: ["Customer focus", "Integrity & ethics", "Communication", "Role knowledge"],
      minQualificationId: q.id,
      minExperienceYears: minExp,
      keywords,
      version: 1,
      status: "approved",
      history: [{ version: 1, at: daysAgo(150), by: hr1.name, note: "Created and approved" }],
      createdAt: daysAgo(150),
      updatedAt: daysAgo(150),
      updatedBy: hr1.id,
    };
    jds.push(j);
    return j;
  };
  const jdRo = jd(
    "Relationship Officer – Microfinance",
    dep.mfo,
    ds.ro,
    gr.og3,
    "Branch Manager",
    "Builds and looks after a portfolio of micro-entrepreneurs and salaried customers, from first visit to full repayment.",
    [
      "Identify and visit prospective borrowers in the branch catchment area",
      "Assess household cash flows and prepare loan proposals",
      "Monitor repayments and follow up early on any overdue instalment",
      "Explain products, pricing and customer rights clearly and fairly",
      "Meet monthly targets for disbursement, portfolio quality and cross-sell",
    ],
    [
      "Bachelor's degree (14 years) in any discipline",
      "1+ year in microfinance, consumer lending or field sales",
      "Fluent Urdu and the local language of the area",
      "Own motorbike and valid licence preferred",
    ],
    ["microfinance", "loan", "recovery", "field", "sales", "customer"],
    1,
    ql.bach,
  );
  const jdCso = jd(
    "Customer Service Officer",
    dep.ret,
    ds.cso,
    gr.og3,
    "Branch Operations Manager",
    "First point of contact in the branch: account opening, transactions and complaint resolution with a welcoming, compliant service.",
    [
      "Open accounts with full KYC and biometric verification",
      "Process cash and clearing transactions accurately",
      "Resolve customer queries and log complaints within service standards",
      "Promote digital channels and the ABHI app",
    ],
    ["Bachelor's degree (14 years)", "Fresh graduates welcome", "Strong communication and computer skills"],
    ["customer", "kyc", "cash", "banking", "complaint"],
    0,
    ql.bach,
  );
  const jdCo = jd(
    "Credit Officer",
    dep.crd,
    ds.co,
    gr.og2,
    "Head of Credit",
    "Reviews loan applications against the credit policy and protects portfolio quality.",
    [
      "Analyse borrower financials, eCIB reports and repayment capacity",
      "Recommend approval, conditions or decline in line with policy",
      "Track early-warning indicators and portfolio-at-risk",
    ],
    ["Bachelor's (16 years) in Finance, Accounting or Economics", "2+ years in credit analysis", "Working knowledge of SBP Prudential Regulations for MFBs"],
    ["credit", "analysis", "ecib", "risk", "portfolio", "excel"],
    2,
    ql.bach16,
  );
  const jdSe = jd(
    "Software Engineer – Digital Lending",
    dep.it,
    ds.se,
    gr.og1,
    "Engineering Manager",
    "Builds and runs the services behind ABHI's digital lending and earned-wage products.",
    [
      "Design, build and test backend services and APIs",
      "Work with product and risk teams on new lending journeys",
      "Keep services secure, observable and reliable",
    ],
    ["Bachelor's (16 years) in Computer Science or similar", "3+ years building production systems", "Experience with TypeScript/Node, Java or Go; SQL"],
    ["typescript", "node", "java", "sql", "api", "cloud", "microservices"],
    3,
    ql.bach16,
  );
  const jdPm = jd(
    "Digital Product Manager",
    dep.dig,
    ds.pm,
    gr.avp,
    "Head of Digital Banking",
    "Owns a digital banking product end to end: discovery, delivery and growth.",
    ["Set the roadmap from customer research and data", "Lead a cross-functional squad", "Track adoption, activation and retention"],
    ["Master's or Bachelor's (16 years)", "5+ years in product management, fintech preferred"],
    ["product", "roadmap", "fintech", "agile", "analytics", "ux"],
    5,
    ql.bach16,
  );
  const jdRa = jd(
    "Risk Analyst",
    dep.crd,
    ds.ra,
    gr.og1,
    "Head of Credit & Risk",
    "Builds risk reporting and scorecards for the microfinance portfolio.",
    ["Prepare portfolio risk dashboards", "Support scorecard development and validation", "Stress-test portfolio under scenarios"],
    ["Bachelor's (16 years) in Statistics, Economics or Finance", "2+ years in risk analytics", "SQL and Python or R"],
    ["sql", "python", "risk", "statistics", "scorecard", "power bi"],
    2,
    ql.bach16,
  );

  // ---------- requisitions ----------
  const requisitions: Requisition[] = [];
  const approvedChain = (label: string[], doneUntil: number, rejectedAt?: number) =>
    label.map((l, i) => ({
      step: i + 1,
      label: l,
      status: (rejectedAt === i ? "rejected" : i < doneUntil ? "approved" : "pending") as "approved" | "pending" | "rejected",
      by: i < doneUntil || rejectedAt === i ? [mgr1, hr1, admin, admin][i]!.id : undefined,
      byName: i < doneUntil || rejectedAt === i ? [mgr1, hr1, admin, admin][i]!.name : undefined,
      at: i < doneUntil || rejectedAt === i ? daysAgo(60 - i * 3) : undefined,
    }));
  const chain = ["Department Head", "HR Business Partner", "Finance", "CEO"];
  let reqN = 0;
  const req = (
    j: JobDescription,
    branch: MasterItem,
    headcount: number,
    budget: HeadcountBudget | undefined,
    status: Requisition["status"],
    doneUntil: number,
    salary: [number, number],
    mgr: User,
    priority: Requisition["priority"] = "normal",
    filled = 0,
  ) => {
    const r: Requisition = {
      id: id("r_"),
      code: `REQ-2026-${String(++reqN).padStart(4, "0")}`,
      jdId: j.id,
      title: j.title,
      departmentId: j.departmentId,
      branchId: branch.id,
      designationId: j.designationId,
      gradeId: j.gradeId,
      employmentTypeId: et.perm.id,
      headcount,
      filled,
      kind: reqN % 3 === 0 ? "replacement" : "new",
      budgetId: budget?.id,
      salaryMin: salary[0],
      salaryMax: salary[1],
      justification: "Branch expansion plan approved in the FY 2026-27 business plan; current team is at full capacity.",
      targetStartDate: daysAhead(30 + reqN * 5).slice(0, 10),
      priority,
      status,
      approvals: approvedChain(chain, doneUntil, status === "rejected" ? 2 : undefined),
      hiringManagerId: mgr.id,
      recruiterId: reqN % 2 ? hr1.id : hr2.id,
      createdBy: hr1.id,
      createdAt: daysAgo(70 - reqN * 4),
      updatedAt: daysAgo(30),
    };
    requisitions.push(r);
    return r;
  };
  const rRo = req(jdRo, br.lhr, 4, bRo, "approved", 4, [70000, 95000], mgr3, "high", 1);
  const rCso = req(jdCso, br.khi2, 2, bCso, "approved", 4, [60000, 80000], mgr3);
  const rCo = req(jdCo, br.khi, 1, bCo, "approved", 4, [120000, 170000], mgr2, "high");
  const rSe = req(jdSe, br.khi, 2, bSe, "approved", 4, [250000, 380000], mgr1, "urgent");
  const rPm = req(jdPm, br.khi, 1, bPm, "approved", 4, [450000, 600000], mgr1);
  req(jdRa, br.khi, 1, bRa, "pending", 2, [180000, 240000], mgr2);
  req(jdRo, br.mux, 3, bRo, "pending", 1, [65000, 90000], mgr3);
  req(jdSe, br.isb, 1, bSe, "draft", 0, [250000, 350000], mgr1, "low");
  req(jdCso, br.pew, 1, bCso, "rejected", 2, [60000, 75000], mgr3);

  // ---------- postings ----------
  const postings: JobPosting[] = [];
  const post = (r: Requisition, j: JobDescription, city: string, minExp: number, q: MasterItem, cities: string[], ko: [string, "yes" | "no"][], showSalary = false) => {
    const p: JobPosting = {
      id: id("p_"),
      requisitionId: r.id,
      slug: `${j.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${city.toLowerCase()}`,
      title: j.title,
      departmentId: r.departmentId,
      branchId: r.branchId,
      city,
      employmentTypeId: r.employmentTypeId,
      summary: j.summary,
      responsibilities: j.responsibilities,
      requirements: j.requirements,
      benefits: ["Provident fund and gratuity", "Health insurance for you and your family", "Subsidised staff loans", "Structured learning with ifSPACE-certified courses", "Annual performance bonus"],
      channels: ["Careers website", "LinkedIn", "Rozee.pk"],
      visibility: "both",
      showSalary,
      salaryMin: r.salaryMin,
      salaryMax: r.salaryMax,
      openDate: daysAgo(35).slice(0, 10),
      closeDate: daysAhead(20).slice(0, 10),
      status: "open",
      knockoutQuestions: ko.map(([question, requiredAnswer]) => ({ id: id("q_"), question, requiredAnswer })),
      criteria: { minQualificationId: q.id, minExperienceYears: minExp, keywords: j.keywords, preferredCities: cities },
      views: 200 + Math.floor(rand() * 1800),
      createdBy: hr1.id,
      createdAt: daysAgo(35),
    };
    postings.push(p);
    return p;
  };
  const pRo = post(rRo, jdRo, "Lahore", 1, ql.bach, ["Lahore"], [["Are you willing to work in the field and visit customers daily?", "yes"]], true);
  const pCso = post(rCso, jdCso, "Karachi", 0, ql.bach, ["Karachi"], [["Have you completed at least 14 years of education?", "yes"]], true);
  const pCo = post(rCo, jdCo, "Karachi", 2, ql.bach16, ["Karachi"], [["Do you have at least 2 years of credit analysis experience?", "yes"]]);
  const pSe = post(rSe, jdSe, "Karachi", 3, ql.bach16, ["Karachi", "Lahore", "Islamabad"], [["Are you legally able to work in Pakistan?", "yes"]]);
  const pPm = post(rPm, jdPm, "Karachi", 5, ql.bach16, ["Karachi"], []);

  // ---------- candidates & applications ----------
  const candidates: CandidateProfile[] = [];
  const applications: Application[] = [];
  const cities = ["Karachi", "Lahore", "Islamabad", "Faisalabad", "Multan", "Hyderabad", "Peshawar"];
  const skillSets: Record<string, string[]> = {
    [pRo.id]: ["microfinance", "loan", "recovery", "field sales", "customer service", "Urdu", "Punjabi"],
    [pCso.id]: ["customer service", "cash handling", "KYC", "MS Office", "banking", "complaint handling"],
    [pCo.id]: ["credit analysis", "eCIB", "financial statements", "Excel", "risk", "portfolio"],
    [pSe.id]: ["TypeScript", "Node", "SQL", "API design", "AWS cloud", "Docker", "microservices", "Java"],
    [pPm.id]: ["product", "roadmap", "fintech", "agile", "analytics", "UX research"],
  };
  const titles: Record<string, string[]> = {
    [pRo.id]: ["Loan Officer", "Field Sales Executive", "Recovery Officer"],
    [pCso.id]: ["Fresh graduate", "Customer Service Representative", "Teller"],
    [pCo.id]: ["Credit Analyst", "Junior Credit Officer"],
    [pSe.id]: ["Software Engineer", "Backend Developer", "Full-stack Developer"],
    [pPm.id]: ["Product Manager", "Product Owner"],
  };
  const employers = ["Kashf Foundation", "NRSP Bank", "HBL", "Meezan Bank", "Telenor Microfinance Bank", "Systems Ltd", "Arbisoft", "Jazz", "Bank Alfalah", "Fresh graduate"];
  const plan: [JobPosting, Stage[]][] = [
    [pRo, ["applied", "applied", "screening", "screening", "shortlisted", "shortlisted", "interview", "interview", "verification", "offer", "hired"]],
    [pCso, ["applied", "applied", "applied", "screening", "shortlisted", "interview", "verification"]],
    [pCo, ["applied", "screening", "shortlisted", "interview", "interview"]],
    [pSe, ["applied", "applied", "screening", "screening", "shortlisted", "interview", "interview", "offer"]],
    [pPm, ["applied", "screening", "shortlisted", "interview"]],
  ];
  const candUsers: User[] = [];
  let appN = 0;
  let candN = 0;
  for (const [p, stages] of plan) {
    for (const stage of stages) {
      candN++;
      const name = `${pick(first)} ${pick(last)}`;
      const email = candN === 1 ? "candidate@example.com" : `${name.toLowerCase().replace(/\s+/g, ".")}.${candN}@example.com`;
      const user: User = { id: id("u_"), email, name, role: "candidate", passwordHash: pw, active: true, createdAt: daysAgo(40) };
      users.push(user);
      candUsers.push(user);
      const sk = skillSets[p.id]!;
      const skills = sk.filter(() => rand() > 0.3);
      const exp = Math.max(0, Math.round((p.criteria.minExperienceYears + (rand() * 4 - 1.2)) * 10) / 10);
      const cand: CandidateProfile = {
        id: id("c_"),
        userId: user.id,
        name,
        email,
        phone: `03${Math.floor(rand() * 9)}${String(Math.floor(rand() * 1e8)).padStart(8, "0")}`,
        cnic: `${42000 + Math.floor(rand() * 9999)}-${String(Math.floor(rand() * 1e7)).padStart(7, "0")}-${Math.floor(rand() * 9)}`,
        city: rand() > 0.3 ? p.city : pick(cities),
        currentTitle: pick(titles[p.id]!),
        currentEmployer: pick(employers),
        totalExperienceYears: exp,
        qualificationId: pick([ql.bach.id, ql.bach16.id, ql.bach16.id, ql.mast.id]),
        institution: pick(["IBA Karachi", "LUMS", "University of the Punjab", "FAST-NUCES", "NUST", "University of Karachi", "Bahauddin Zakariya University"]),
        skills,
        cvText: `${name} — ${skills.join(", ")}. ${exp} years of experience.`,
        talentPool: rand() > 0.7,
        createdAt: daysAgo(40),
        updatedAt: daysAgo(20),
      };
      candidates.push(cand);
      const stageIdx = STAGES.findIndex((s) => s.key === stage);
      const created = 34 - Math.floor(rand() * 10);
      const app: Application = {
        id: id("a_"),
        code: `APP-2026-${String(++appN).padStart(5, "0")}`,
        postingId: p.id,
        candidateId: cand.id,
        stage,
        status: stage === "hired" ? "hired" : "active",
        sourceId: pick(sources).id,
        knockoutAnswers: Object.fromEntries(p.knockoutQuestions.map((q) => [q.id, rand() > 0.12 || stageIdx > 0 ? q.requiredAnswer : q.requiredAnswer === "yes" ? "no" : "yes"])),
        expectedSalary: Math.round(((p.salaryMin ?? 80000) + rand() * ((p.salaryMax ?? 120000) - (p.salaryMin ?? 80000)) * 1.2) / 1000) * 1000,
        noticePeriodDays: pick([0, 15, 30, 30, 60]),
        stageHistory: STAGES.slice(0, stageIdx + 1).map((s, i) => ({ stage: s.key, at: daysAgo(created - i * 4), by: i === 0 ? user.id : hr1.id })),
        tags: [],
        notes: [],
        consentAt: daysAgo(created),
        createdAt: daysAgo(created),
        updatedAt: daysAgo(Math.max(1, created - stageIdx * 4)),
      };
      const tmpDb = { master } as unknown as Db;
      app.screening = screen(tmpDb, app, cand, p);
      if (stageIdx >= 2) {
        app.decision = "shortlist";
        app.decisionBy = hr1.id;
      }
      applications.push(app);
    }
  }
  // a few rejected applications for the analytics (the demo candidate stays active)
  for (const a of applications.filter((x) => x.stage === "applied").slice(1, 4)) {
    a.status = "rejected";
    a.decision = "reject";
    a.rejectionReasonId = master.find((x) => x.type === "rejection_reason")!.id;
  }

  // ---------- interviews & scorecards ----------
  const interviews: Interview[] = [];
  const scorecards: Scorecard[] = [];
  const competencies = master.filter((x) => x.type === "competency").map((x) => x.name);
  let dayOffset = 0;
  for (const a of applications.filter((x) => ["interview", "verification", "offer", "hired"].includes(x.stage))) {
    const p = postings.find((x) => x.id === a.postingId)!;
    const r = requisitions.find((x) => x.id === p.requisitionId)!;
    const past = a.stage !== "interview";
    const mode: Interview["mode"] = interviews.length % 3 === 0 ? "live_video" : interviews.length % 3 === 1 ? "in_person" : "recorded_video";
    const iv: Interview = {
      id: id("i_"),
      applicationId: a.id,
      round: 1,
      title: mode === "recorded_video" ? "One-way video interview" : "Panel interview",
      mode,
      start: past ? daysAhead(-(8 + dayOffset), 10 + (dayOffset % 6)) : daysAhead(1 + (dayOffset % 6), 10 + (dayOffset % 6)),
      durationMin: 45,
      location: mode === "in_person" ? "Karachi Head Office, 5th floor, Meeting Room 2" : undefined,
      meetingUrl: mode === "live_video" ? `https://meet.jit.si/abhi-interview-${a.code.toLowerCase()}` : undefined,
      panel: [r.hiringManagerId!, hr1.id],
      status: past ? "completed" : "scheduled",
      candidateConfirmed: past || rand() > 0.4,
      recordedQuestions:
        mode === "recorded_video"
          ? [
              { id: id("rq_"), question: "Tell us about yourself and why you want to join ABHI.", thinkSeconds: 30, maxSeconds: 120 },
              { id: id("rq_"), question: "Describe a time you solved a difficult customer problem.", thinkSeconds: 30, maxSeconds: 120 },
              { id: id("rq_"), question: "How would you explain a loan's total cost to a first-time borrower?", thinkSeconds: 30, maxSeconds: 90 },
            ]
          : undefined,
      recordings: [],
      createdBy: hr1.id,
      createdAt: daysAgo(15),
    };
    dayOffset++;
    interviews.push(iv);
    if (past) {
      for (const interviewer of iv.panel) {
        const overall = 3 + Math.round(rand() * 2);
        scorecards.push({
          id: id("s_"),
          interviewId: iv.id,
          applicationId: a.id,
          interviewerId: interviewer,
          ratings: competencies.slice(0, 5).map((c) => ({ competency: c, score: Math.min(5, Math.max(2, overall + Math.round(rand() * 2 - 1))) })),
          overall,
          recommendation: overall >= 4 ? "strong_yes" : "yes",
          strengths: "Clear communicator with good knowledge of the customer segment.",
          concerns: overall < 4 ? "Limited exposure to digital channels." : "",
          submittedAt: daysAgo(7 + dayOffset),
        });
      }
    }
  }

  // ---------- verification, offers, hire ----------
  const verifApps = applications.filter((x) => ["verification", "offer", "hired"].includes(x.stage));
  const references: Db["references"] = [];
  const ecib: Db["ecib"] = [];
  for (const a of verifApps) {
    const cand = candidates.find((c) => c.id === a.candidateId)!;
    const done = a.stage !== "verification";
    references.push({
      id: id("rf_"),
      applicationId: a.id,
      refereeName: `${pick(first)} ${pick(last)}`,
      refereeEmail: "referee@example.com",
      refereePhone: "03001234567",
      relationship: "Former line manager",
      company: cand.currentEmployer,
      token: crypto.randomBytes(12).toString("hex"),
      status: done ? "verified" : "requested",
      response: done ? { capacity: "Line manager", period: "2 years", performance: 4, integrity: 5, teamwork: 4, rehire: true, comments: "Reliable and well liked by customers." } : undefined,
      requestedBy: hr1.id,
      requestedAt: daysAgo(10),
      completedAt: done ? daysAgo(6) : undefined,
    });
    ecib.push({
      id: id("ec_"),
      applicationId: a.id,
      cnic: cand.cnic,
      consentAt: daysAgo(9),
      status: done ? "clear" : "submitted",
      outstanding: 0,
      overdueDays: 0,
      remarks: done ? "No adverse credit history." : undefined,
      requestedBy: hr1.id,
      requestedAt: daysAgo(10),
      submittedAt: daysAgo(9),
      resultAt: done ? daysAgo(7) : undefined,
      decidedBy: done ? hr1.id : undefined,
    });
  }

  const offers: Db["offers"] = [];
  let offerN = 0;
  const hires: Db["hires"] = [];
  for (const a of applications.filter((x) => x.stage === "offer" || x.stage === "hired")) {
    const p = postings.find((x) => x.id === a.postingId)!;
    const r = requisitions.find((x) => x.id === p.requisitionId)!;
    const basic = Math.round((r.salaryMin + r.salaryMax) / 2 / 1000) * 600;
    const allowances = [
      { name: "House rent", amount: Math.round(basic * 0.45) },
      { name: "Utilities", amount: Math.round(basic * 0.1) },
      { name: "Fuel / conveyance", amount: 12000 },
    ];
    const accepted = a.stage === "hired";
    const offer: Db["offers"][number] = {
      id: id("o_"),
      code: `OFR-2026-${String(++offerN).padStart(4, "0")}`,
      applicationId: a.id,
      designationId: r.designationId,
      gradeId: r.gradeId,
      departmentId: r.departmentId,
      branchId: r.branchId,
      employmentTypeId: r.employmentTypeId,
      basicSalary: basic,
      allowances,
      grossMonthly: basic + allowances.reduce((s, x) => s + x.amount, 0),
      benefits: ["Provident fund", "Gratuity", "Health insurance (self, spouse, children)", "Annual bonus as per policy"],
      joiningDate: accepted ? daysAgo(3).slice(0, 10) : daysAhead(21).slice(0, 10),
      probationMonths: 6,
      expiresAt: daysAhead(5),
      status: accepted ? "accepted" : "sent",
      approvals: ["HR Head", "Finance"].map((label, i) => ({ step: i + 1, label, status: "approved" as const, by: admin.id, byName: admin.name, at: daysAgo(6 - i) })),
      candidateResponse: accepted ? { at: daysAgo(12), signatureName: candidates.find((c) => c.id === a.candidateId)!.name } : undefined,
      createdBy: hr1.id,
      createdAt: daysAgo(8),
      updatedAt: daysAgo(4),
    };
    offers.push(offer);
    if (accepted) {
      const cand = candidates.find((c) => c.id === a.candidateId)!;
      hires.push({
        id: id("h_"),
        applicationId: a.id,
        candidateId: cand.id,
        userId: cand.userId,
        offerId: offer.id,
        name: cand.name,
        status: "orientation",
        joiningDate: offer.joiningDate,
        buddyName: employees[3]!.name,
        managerId: r.hiringManagerId,
        tasks: defaultOnboardingTasks(offer.joiningDate, id, master),
        badges: ["Welcome aboard"],
        createdAt: daysAgo(12),
      });
    }
  }
  // Mark the pre-joining tasks done for the seeded hire.
  for (const h of hires) for (const t of h.tasks) if (t.phase === "pre_joining") Object.assign(t, { done: true, doneAt: daysAgo(5), doneBy: hr1.id });

  const letters: Db["letters"] = hires.map((h, i) => ({
    id: id("al_"),
    ref: `ABHI/HR/AL/2026/${String(i + 1).padStart(4, "0")}`,
    offerId: h.offerId,
    applicationId: h.applicationId,
    issuedAt: daysAgo(10),
    issuedBy: hr1.id,
    body: "",
    status: "acknowledged",
    acknowledgedAt: daysAgo(9),
    acknowledgedName: h.name,
  }));

  // ---------- orientation modules ----------
  const modules: OrientationModule[] = [
    {
      id: id("om_"),
      title: "Welcome to ABHI",
      kind: "presentation",
      description: "Who we are, who we serve and how we work. Swipe through and collect your first badge.",
      order: 1,
      required: true,
      points: 100,
      durationMin: 10,
      slides: [
        { emoji: "👋", title: "Welcome to the team", body: "You are joining a bank built to make fair, simple financial services available to everyone, from micro-entrepreneurs to salaried workers." },
        { emoji: "🎯", title: "Our purpose", body: "Financial inclusion for the underserved: small loans, savings and digital payments that people can trust and understand." },
        { emoji: "🤝", title: "Our values", body: "Integrity first. Customer at the centre. Own the outcome. Learn every day. Respect for everyone." },
        { emoji: "🏦", title: "How we are organised", body: "Branch and field teams serve customers; Credit & Risk keeps lending healthy; Digital and IT build our channels; support functions keep us safe and compliant." },
        { emoji: "🛡️", title: "Speak up", body: "If something looks wrong, say so. Use the whistle-blowing channel or talk to Compliance. Retaliation is never tolerated." },
      ],
      active: true,
      createdAt: daysAgo(200),
    },
    {
      id: id("om_"),
      title: "Code of Conduct",
      kind: "pdf",
      description: "Read the staff code of conduct. Confirm you have read it to complete this step.",
      order: 2,
      required: true,
      points: 50,
      durationMin: 15,
      active: true,
      createdAt: daysAgo(200),
    },
    {
      id: id("om_"),
      title: "Customer protection & fair treatment",
      kind: "video",
      description: "A short video on treating borrowers fairly: transparent pricing, respectful recovery and complaint handling.",
      order: 3,
      required: true,
      points: 75,
      durationMin: 8,
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      active: true,
      createdAt: daysAgo(200),
    },
    {
      id: id("om_"),
      title: "AML / CFT essentials quiz",
      kind: "quiz",
      description: "Ten minutes to check your understanding of anti-money-laundering basics. Pass mark 70%.",
      order: 4,
      required: true,
      points: 150,
      durationMin: 10,
      quiz: {
        passMark: 70,
        questions: [
          { id: "q1", question: "A customer insists on splitting a large cash deposit into several smaller deposits. What should you do?", options: ["Process them; each is below the limit", "Escalate to Compliance as a possible suspicious transaction", "Refuse the customer and close the account"], answer: 1 },
          { id: "q2", question: "What does KYC stand for?", options: ["Keep Your Cash", "Know Your Customer", "Key Yield Calculation"], answer: 1 },
          { id: "q3", question: "Should you tell a customer that you have reported their transaction as suspicious?", options: ["Yes, always", "Only if they ask", "No, this is 'tipping off' and is prohibited"], answer: 2 },
          { id: "q4", question: "Which document is the primary identity document for Pakistani customers?", options: ["CNIC", "Utility bill", "Student card"], answer: 0 },
          { id: "q5", question: "Who should you contact first with an AML concern?", options: ["Your friends", "Compliance / the MLRO", "The customer's family"], answer: 1 },
        ],
      },
      active: true,
      createdAt: daysAgo(200),
    },
    {
      id: id("om_"),
      title: "Information security (SCORM)",
      kind: "scorm",
      description: "Interactive course in SCORM 1.2 format. Upload your bank's package from Orientation → Modules; until then a built-in sample runs.",
      order: 5,
      required: true,
      points: 125,
      durationMin: 15,
      active: true,
      createdAt: daysAgo(200),
    },
  ];

  // ---------- experience surveys ----------
  const surveys: Survey[] = [];
  const touch: Survey["touchpoint"][] = ["application", "application", "interview", "interview", "offer", "orientation", "onboarding"];
  const comments = [
    "The application was quick and the status updates were helpful.",
    "Interview panel was friendly and well prepared.",
    "Would like faster feedback after the interview.",
    "Loved the video interview option, saved me a trip.",
    "Clear offer letter, everything explained.",
    "The orientation game was fun!",
    "Took a while to hear back after applying.",
    "",
  ];
  for (let i = 0; i < 64; i++) {
    const a = applications[i % applications.length]!;
    const cand = candidates.find((c) => c.id === a.candidateId)!;
    const tp = touch[i % touch.length]!;
    const base = tp === "interview" ? 8 : tp === "application" ? 7 : 9;
    surveys.push({
      id: id("sv_"),
      touchpoint: tp,
      applicationId: a.id,
      userId: cand.userId,
      nps: Math.max(0, Math.min(10, base + Math.round(rand() * 4 - 2))),
      csat: Math.max(1, Math.min(5, 4 + Math.round(rand() * 2 - 1))),
      ease: Math.max(1, Math.min(5, 4 + Math.round(rand() * 2 - 1.2))),
      comments: pick(comments) || undefined,
      at: daysAgo(Math.floor(rand() * 90)),
    });
  }

  const d: Db = {
    version: 1,
    settings: {
      companyName: "ABHI Microfinance Bank Limited",
      shortName: "ABHI",
      primaryColor: "#0e7c66",
      careersIntro: "Build fair, simple finance for millions of Pakistanis. Find a role where your work changes lives.",
      supportEmail: "careers@abhi.com.pk",
      employeeIdPrefix: "ABHI",
      employeeIdPattern: "{PREFIX}-{YYYY}-{SEQ:4}",
      nextEmployeeSeq: 1001,
      requisitionApprovalChain: chain,
      offerApprovalChain: ["HR Head", "Finance"],
      statusChangeApprovalChain: ["Line Manager", "HR Head"],
      blindScreening: false,
      autoShortlistThreshold: 75,
      autoRejectKnockout: false,
      interviewDefaultMinutes: 45,
      orientationPassMark: 70,
      offerValidityDays: 7,
      candidateDataRetentionMonths: 24,
      surveysEnabled: true,
      employeeApi: {
        url: "",
        authHeader: "Authorization",
        authValue: "",
        fieldMap: {
          employeeNo: "employee_code",
          name: "full_name",
          email: "official_email",
          phone: "mobile",
          cnic: "cnic",
          department: "department_code",
          branch: "branch_code",
          designation: "designation_code",
          grade: "grade_code",
          joiningDate: "date_of_joining",
          status: "employment_status",
        },
        outboundApiKey: crypto.randomBytes(18).toString("base64url"),
        lastSyncAt: daysAgo(1),
        lastSyncStatus: "Seeded demo data (84 records). Connect the bank's HR API in Admin → Integrations.",
        autoSyncHours: 0,
      },
    },
    users,
    master,
    budgets,
    jds,
    requisitions,
    postings,
    candidates,
    applications,
    interviews,
    scorecards,
    references,
    ecib,
    offers,
    letters,
    modules,
    progress: [],
    hires,
    employees,
    statusChanges: [
      {
        id: id("sc_"),
        code: "STC-2026-0001",
        employeeId: employees[5]!.id,
        type: "promotion",
        from: { gradeId: employees[5]!.gradeId, designationId: employees[5]!.designationId, basicSalary: employees[5]!.basicSalary },
        to: { gradeId: gr.avp.id, designationId: employees[5]!.designationId, basicSalary: (employees[5]!.basicSalary ?? 100000) + 40000 },
        effectiveDate: daysAhead(5).slice(0, 10),
        reason: "Annual performance review: exceeded targets for two consecutive years.",
        status: "pending",
        approvals: [
          { step: 1, label: "Line Manager", status: "approved", by: mgr2.id, byName: mgr2.name, at: daysAgo(2) },
          { step: 2, label: "HR Head", status: "pending" },
        ],
        requestedBy: mgr2.id,
        createdAt: daysAgo(3),
      },
    ],
    surveys,
    audit: [
      {
        id: id("au_"),
        at: daysAgo(0),
        actorId: "system",
        actorName: "System",
        actorRole: "system",
        action: "system.seed",
        entity: "system",
        entityId: "seed",
        summary: "Portal initialised with demo data",
      },
    ],
    notifications: [],
    files: [],
    counters: { "REQ-2026": reqN, "APP-2026": appN, "OFR-2026": offerN, "STC-2026": 1 },
  };
  void candUsers;
  return d;
}

export function defaultOnboardingTasks(
  joiningDate: string,
  makeId: (p: string) => string,
  master: MasterItem[],
): Db["hires"][number]["tasks"] {
  const j = new Date(joiningDate).getTime();
  const at = (days: number) => new Date(j + days * 86_400_000).toISOString().slice(0, 10);
  const doc = (code: string) => master.find((m) => m.type === "document_type" && m.code === code)?.id;
  const t = (title: string, phase: Db["hires"][number]["tasks"][number]["phase"], owner: Db["hires"][number]["tasks"][number]["owner"], days: number, documentTypeId?: string) => ({
    id: makeId("t_"),
    title,
    phase,
    owner,
    dueDate: at(days),
    done: false,
    documentTypeId,
  });
  return [
    t("Upload CNIC (both sides)", "pre_joining", "new_hire", -5, doc("CNIC")),
    t("Upload educational certificates", "pre_joining", "new_hire", -5, doc("EDU")),
    t("Upload passport-size photograph", "pre_joining", "new_hire", -5, doc("PHOTO")),
    t("Submit bank account details for payroll", "pre_joining", "new_hire", -3, doc("BANK")),
    t("Medical fitness certificate", "pre_joining", "new_hire", -2, doc("MED")),
    t("Create network, email and core-banking accounts", "pre_joining", "it", -1),
    t("Prepare desk, laptop and access card", "pre_joining", "admin", -1),
    t("Welcome by line manager and team introduction", "day_one", "manager", 0),
    t("Complete orientation modules on the portal", "day_one", "new_hire", 2),
    t("Collect ID card and sign policy acknowledgements", "day_one", "hr", 0),
    t("Meet your onboarding buddy", "first_week", "manager", 3),
    t("Agree 90-day goals with your manager", "first_week", "manager", 5),
    t("Enrol in provident fund and health insurance", "first_week", "hr", 5),
    t("30-day check-in with HR", "first_30", "hr", 30),
    t("Complete mandatory product & compliance training", "first_30", "new_hire", 30),
    t("90-day probation review", "first_90", "manager", 90),
    t("Onboarding experience survey", "first_90", "new_hire", 90),
  ];
}
