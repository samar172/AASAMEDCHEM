import LogoutButton from "./logout-button";
import SideNav from "./side-nav";
import type { SessionPayload } from "@/lib/jwt";

export interface NavLink {
  href: string;
  label: string;
}

/**
 * App shell with a top bar (brand, role badge, sign out) and a left nav.
 * Shared by both the admin and seller panels.
 */
export default function Shell({
  session,
  links,
  children,
}: {
  session: SessionPayload;
  links: NavLink[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-brand-700">AasaMedChem</span>
            <span className="badge bg-brand-50 text-brand-700 capitalize">
              {session.role}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {session.name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <nav className="w-48 shrink-0">
          <SideNav links={links} />
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
