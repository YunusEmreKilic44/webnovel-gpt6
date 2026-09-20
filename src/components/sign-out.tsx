"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LogOut } from "./icons";
export function SignOut({
  className = "button button-outline",
  role,
}: {
  className?: string;
  role?: "menuitem";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        role={role}
        className={className}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const result = await authClient.signOut();
            if (result.error) throw new Error("sign-out failed");
            router.push("/");
            router.refresh();
          } catch {
            setError("Çıkış yapılamadı. Tekrar dene.");
          } finally {
            setPending(false);
          }
        }}
      >
        <LogOut size={16} />
        {pending ? "Çıkılıyor…" : "Çıkış yap"}
      </button>
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
    </>
  );
}
