import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/** Root: route users to their panel, or to login. */
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(session.role === "admin" ? "/admin" : "/seller");
}
