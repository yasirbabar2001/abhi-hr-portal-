"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp, hashPassword, passwordProblem, startSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db, mutate, nowIso, uid } from "@/lib/store";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your full name."),
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
  phone: z.string().trim().min(10, "Please enter a valid mobile number."),
  password: z.string(),
});

export async function register(form: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(form));
  const next = String(form.get("next") ?? "");
  const back = (err: string) => redirect(`/register?err=${encodeURIComponent(err)}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  if (!parsed.success) back(parsed.error.issues[0]!.message);
  const { name, email, phone, password } = parsed.data!;
  const problem = passwordProblem(password);
  if (problem) back(problem);
  if (!form.get("consent")) back("Please accept the privacy notice to continue.");
  if (db().users.some((u) => u.email.toLowerCase() === email)) back("An account with this email already exists. Please sign in.");
  const ip = await clientIp();
  const userId = mutate((d) => {
    const id = uid("u_");
    const at = nowIso();
    d.users.push({ id, email, name, role: "candidate", passwordHash: hashPassword(password), active: true, phone, createdAt: at, lastLoginAt: at });
    d.candidates.push({
      id: uid("c_"),
      userId: id,
      name,
      email,
      phone,
      cnic: "",
      city: "",
      currentTitle: "",
      currentEmployer: "",
      totalExperienceYears: 0,
      skills: [],
      talentPool: !!form.get("talentPool"),
      createdAt: at,
      updatedAt: at,
    });
    audit(d, { id, name, role: "candidate" }, "auth.register", "user", id, `${name} created a candidate account`, { ip });
    return id;
  });
  await startSession(userId);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/me/profile?msg=Welcome!+Complete+your+profile+to+apply+faster.");
}
