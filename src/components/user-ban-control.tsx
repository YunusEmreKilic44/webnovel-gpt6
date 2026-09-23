import { ActionForm, SubmitButton } from "./action-form";
import { ReasonField } from "./admin-ui";
import { banUserAction } from "@/modules/admin/actions";

export function UserBanControl({
  userId,
  banned,
  self = false,
}: {
  userId: string;
  banned: boolean;
  self?: boolean;
}) {
  if (self) return <span className="muted">Kendi hesabın</span>;
  return (
    <details className="admin-moderation user-ban-control" key={String(banned)}>
      <summary
        className={`button button-small ${banned ? "button-outline" : "button-danger"}`}
      >
        {banned ? "Banı kaldır" : "Banla"}
      </summary>
      <ActionForm action={banUserAction} className="form-stack">
        <input type="hidden" name="id" value={userId} />
        <input type="hidden" name="banned" value={String(!banned)} />
        <p>
          {banned
            ? "Kullanıcı yeniden giriş yapabilecek."
            : "Tüm oturumlar kapatılacak. Ban kaldırılana kadar kullanıcı giriş yapamayacak."}
        </p>
        <ReasonField />
        <SubmitButton
          className={
            banned
              ? "button-outline button-small"
              : "button-danger button-small"
          }
        >
          {banned ? "Banı kaldır" : "Kullanıcıyı banla"}
        </SubmitButton>
      </ActionForm>
    </details>
  );
}
