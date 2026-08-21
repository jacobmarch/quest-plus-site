import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireDm } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClassManagerDialog } from "@/components/class-manager-dialog";

export default async function TreesPage() {
  await requireDm();
  const supabase = await createClient();

  const [classesRes, countsRes] = await Promise.all([
    supabase.from("classes").select("*").order("name"),
    supabase.from("skills").select("id, class_id"),
  ]);

  const classes = classesRes.data ?? [];
  const skillCounts = new Map<string, number>();
  for (const skill of countsRes.data ?? []) {
    skillCounts.set(skill.class_id, (skillCounts.get(skill.class_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skill Trees</h1>
          <p className="text-sm text-muted-foreground">
            Design per-class trees — add nodes anytime as the system grows
          </p>
        </div>
        <ClassManagerDialog />
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No classes yet. Create your first class to start building its tree.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((cls) => (
            <Link key={cls.id} href={`/trees/${cls.id}`}>
              <Card className="h-full transition-colors hover:border-foreground/30">
                <CardHeader>
                  <CardTitle>{cls.name}</CardTitle>
                  <CardDescription>
                    {skillCounts.get(cls.id) ?? 0} skill(s) ·{" "}
                    {cls.points_per_level} point(s) per level
                  </CardDescription>
                </CardHeader>
                {cls.description ? (
                  <CardContent className="text-sm text-muted-foreground">
                    {cls.description}
                  </CardContent>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
