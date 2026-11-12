"use client";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { useMe } from "@/lib/useMe";

export function AccountMenu() {
  const { user, loaded } = useMe();
  if (!loaded) return <span className="h-8 w-8" />;
  if (!user) return <Link href="/login" className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-white">Sign in</Link>;
  return (
    <Link href="/profile" className="flex items-center gap-2 rounded-full border border-line px-2.5 py-1 text-sm hover:border-gold/50" title={user.email}>
      <UserRound size={14} className="text-gold" /><span className="hidden max-w-[120px] truncate lg:inline">{user.name ?? user.email}</span>
      {user.key && <span className="h-1.5 w-1.5 rounded-full bg-[#c084fc]" title={`AI: ${user.key.provider}`} />}
    </Link>
  );
}
