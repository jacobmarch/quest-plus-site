import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireDm } from "@/lib/auth";
import { DeleteClassButton } from "@/components/class-manager-dialog";
import { TreeEditor } from "@/components/tree-editor";

export default async function TreeDetailPage({
  params,
}: PageProps<"/trees/[classId]">) {
  const { classId } = await params;
  await requireDm();
  const supabase = await createClient();

  const [{ data: cls }, skillsRes] = await Promise.all([
    supabase.from("classes").select("*").eq("id", classId).maybeSingle(),
    supabase
      .from("skills")
      .select("*")
      .eq("class_id", classId)
      .order("created_at"),
  ]);

  if (!cls) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{cls.name} tree</h1>
          <p className="text-sm text-muted-foreground">
            Drag nodes to arrange · drag between handles to link prerequisites
            · select a node to edit details
          </p>
        </div>
        <DeleteClassButton classId={cls.id} />
      </div>
      <TreeEditor classId={cls.id} skills={skillsRes.data ?? []} />
    </div>
  );
}
