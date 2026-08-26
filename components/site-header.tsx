"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut } from "lucide-react";

export function SiteHeader() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-5xl mx-auto px-4 md:px-8 lg:px-12 h-14 flex items-center justify-between">
        <span className="font-semibold text-primary">Voucher Optima</span>

        {status === "loading" ? null : session?.user ? (
          <div className="flex items-center gap-3">
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name ?? "User"}
                className="w-7 h-7 rounded-full"
              />
            )}
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {session.user.name}
            </span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-1" />
              Sign out
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => signIn("google")}>
            <LogIn className="h-4 w-4 mr-1" />
            Sign in with Google
          </Button>
        )}
      </div>
    </header>
  );
}
