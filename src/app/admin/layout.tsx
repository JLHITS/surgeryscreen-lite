import type { ReactNode } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { getSession } from "@/lib/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return (
    <div className="min-h-full">
      {session && <AdminHeader />}
      {children}
    </div>
  );
}
