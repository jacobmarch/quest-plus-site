import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { getSessionContext } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh">
      <Sidebar
        displayName={session.profile.display_name}
        role={session.profile.role}
      />
      <main className="flex-1 overflow-x-hidden p-6">{children}</main>
    </div>
  );
}
