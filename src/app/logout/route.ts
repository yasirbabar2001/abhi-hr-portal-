import { NextResponse } from "next/server";
import { currentUser, endSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { mutate } from "@/lib/store";

export async function POST(req: Request) {
  const user = await currentUser();
  if (user) mutate((d) => audit(d, user, "auth.logout", "user", user.id, `${user.name} signed out`));
  await endSession();
  return NextResponse.redirect(new URL("/login?msg=You+have+signed+out.", req.url), 303);
}
