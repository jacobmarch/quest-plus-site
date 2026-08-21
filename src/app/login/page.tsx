"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </main>
  );
}

function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmSent = searchParams.get("confirm") === "sent";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signIn(
        String(formData.get("email") ?? ""),
        String(formData.get("password") ?? ""),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">
          Quest Plus
        </CardTitle>
        <CardDescription>Sign in to your campaign</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {confirmSent ? (
          <p
            className="rounded-md border border-border bg-muted px-3 py-2 text-sm"
            role="status"
          >
            Account created. Check your inbox for a confirmation link, then
            sign in below.
          </p>
        ) : null}
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          No account yet?{" "}
          <Link href="/signup" className="underline underline-offset-4">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
