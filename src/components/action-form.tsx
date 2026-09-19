"use client";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { initialActionState, type FormAction } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { LoaderCircle } from "./icons";

export function SubmitButton({
  children,
  className,
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      name={name}
      value={value}
      type="submit"
      className={cn("button", className ?? "button-dark")}
      disabled={disabled || pending}
    >
      {pending && <LoaderCircle size={15} className="spin" />}
      {pending ? "Kaydediliyor…" : children}
    </button>
  );
}
export function ActionForm({
  id,
  action,
  children,
  className,
}: {
  id?: string;
  action: FormAction;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const router = useRouter();
  useEffect(() => {
    if (state.ok && state.href) router.push(state.href);
  }, [state, router]);
  return (
    <form id={id} action={formAction} className={className}>
      {children}
      {state.message && (
        <p
          role="status"
          className={cn("form-message", state.ok ? "success" : "error")}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
