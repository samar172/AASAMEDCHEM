"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavLink } from "./shell";

export default function SideNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {links.map((l) => {
        const isActive = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
