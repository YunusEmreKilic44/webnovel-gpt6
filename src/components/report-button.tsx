"use client";
import { useActionState, useId, useRef, useState } from "react";
import Link from "next/link";
import { createReportAction } from "@/modules/reports/actions";
import { initialActionState } from "@/lib/action-state";
import {
  REPORT_DETAILS_MAX,
  REPORT_OTHER_MIN,
  reasonsByTarget,
  reportReasons,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/reports";
import { cn } from "@/lib/utils";
import { SubmitButton } from "./action-form";
import { CheckCircle2, Flag, X } from "./icons";

export type ReportTarget = {
  type: ReportTargetType;
  id: string;
  /** Shown when there is more than one target, e.g. "Bu yorumu". */
  label: string;
};

/**
 * "Report" trigger that opens a modal with reasons for the chosen target and
 * an optional explanation. Signed-out visitors are sent to sign in instead.
 */
export function ReportButton({
  targets,
  signedIn,
  label = "Şikâyet et",
  className,
}: {
  targets: ReportTarget[];
  signedIn: boolean;
  label?: string;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [session, setSession] = useState(0);
  const titleId = useId();
  if (!signedIn)
    return (
      <Link href="/giris" className={cn("report-trigger", className)}>
        <Flag size={14} /> {label}
      </Link>
    );
  const close = () => dialog.current?.close();
  return (
    <>
      <button
        type="button"
        className={cn("report-trigger", className)}
        aria-haspopup="dialog"
        onClick={() => {
          // A fresh form every time the dialog opens.
          setSession((n) => n + 1);
          dialog.current?.showModal();
        }}
      >
        <Flag size={14} /> {label}
      </button>
      <dialog
        ref={dialog}
        className="report-dialog"
        aria-labelledby={titleId}
        onClick={(event) => {
          // Clicking the backdrop (the dialog element itself) closes it.
          if (event.target === event.currentTarget) close();
        }}
      >
        {session > 0 && (
          <ReportForm
            key={session}
            targets={targets}
            titleId={titleId}
            onClose={close}
          />
        )}
      </dialog>
    </>
  );
}

function ReportForm({
  targets,
  titleId,
  onClose,
}: {
  targets: ReportTarget[];
  titleId: string;
  onClose: () => void;
}) {
  const [state, action] = useActionState(
    createReportAction,
    initialActionState,
  );
  const [targetIndex, setTargetIndex] = useState(0);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const target = targets[targetIndex];
  const reasons = reasonsByTarget[target.type];
  const needsDetails = reason === "OTHER";

  if (state.ok)
    return (
      <div className="report-done" role="status">
        <CheckCircle2 size={34} />
        <h2 id={titleId}>Şikâyetin alındı</h2>
        <p>{state.message}</p>
        <button type="button" className="button button-dark" onClick={onClose}>
          Kapat
        </button>
      </div>
    );

  return (
    <form action={action} className="report-form">
      <header>
        <h2 id={titleId}>
          <Flag size={18} /> Şikâyet et
        </h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Kapat"
        >
          <X size={18} />
        </button>
      </header>
      <input type="hidden" name="targetType" value={target.type} />
      <input type="hidden" name="targetId" value={target.id} />

      {targets.length > 1 && (
        <fieldset className="report-targets">
          <legend>Neyi şikâyet ediyorsun?</legend>
          <div className="segmented">
            {targets.map((option, index) => (
              <label key={`${option.type}:${option.id}`}>
                <input
                  type="radio"
                  name="target"
                  checked={index === targetIndex}
                  onChange={() => {
                    setTargetIndex(index);
                    // Reasons differ per target; keep only a valid choice.
                    if (
                      reason &&
                      !reasonsByTarget[option.type].includes(reason)
                    )
                      setReason("");
                  }}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="report-reasons">
        <legend>Sebep</legend>
        {reasons.map((value) => (
          <label key={value} className={cn(reason === value && "is-selected")}>
            <input
              type="radio"
              name="reason"
              value={value}
              required
              checked={reason === value}
              onChange={() => setReason(value)}
            />
            {reportReasons[value]}
          </label>
        ))}
      </fieldset>

      <label className="field">
        {needsDetails
          ? "Ne oldu? (zorunlu)"
          : "Eklemek istediklerin (isteğe bağlı)"}
        <textarea
          name="details"
          rows={4}
          maxLength={REPORT_DETAILS_MAX}
          minLength={needsDetails ? REPORT_OTHER_MIN : undefined}
          required={needsDetails}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Ekibin durumu anlamasına yardımcı olacak ayrıntılar…"
        />
        <small>
          {details.length}/{REPORT_DETAILS_MAX} · Şikâyetin gizlidir; şikâyet
          edilen kişiye adın gösterilmez.
        </small>
      </label>

      {state.message && !state.ok && (
        <p role="alert" className="form-message error">
          {state.message}
        </p>
      )}
      <div className="report-actions">
        <button
          type="button"
          className="button button-outline"
          onClick={onClose}
        >
          Vazgeç
        </button>
        <SubmitButton disabled={!reason}>Şikâyeti gönder</SubmitButton>
      </div>
    </form>
  );
}
