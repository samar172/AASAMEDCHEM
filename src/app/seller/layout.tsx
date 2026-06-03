import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell, { type NavLink } from "@/components/shell";

const LINKS: NavLink[] = [
  { href: "/seller/products", label: "Browse" },
  { href: "/seller/orders", label: "My Orders" },
];

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "seller") redirect("/admin");

  return (
    <Shell session={session} links={LINKS}>
      {children}
    </Shell>
  );
}
