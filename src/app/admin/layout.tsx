import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell, { type NavLink } from "@/components/shell";

const LINKS: NavLink[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/orders", label: "Orders" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/seller");

  return (
    <Shell session={session} links={LINKS}>
      {children}
    </Shell>
  );
}
