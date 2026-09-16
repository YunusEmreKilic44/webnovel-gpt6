"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LogOut } from "./icons";
export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      className="button button-outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await authClient.signOut();
          router.push("/");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      <LogOut size={16} />
      {pending ? "Çıkılıyor…" : "Çıkış yap"}
    </button>
  );
}
