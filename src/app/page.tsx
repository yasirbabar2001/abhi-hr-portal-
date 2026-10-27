import { redirect } from "next/navigation";
import { currentUser, isInternal } from "@/lib/auth";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/careers");
  redirect(isInternal(user) ? "/hr" : "/me");
}
