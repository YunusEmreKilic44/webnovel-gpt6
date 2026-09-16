export type ActionState = {
  ok: boolean;
  message: string;
  href?: string;
  version?: number;
  nonce?: string;
};
export const initialActionState: ActionState = { ok: false, message: "" };
export type FormAction = (
  previous: ActionState,
  form: FormData,
) => Promise<ActionState>;
