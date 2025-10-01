import { get, set, del } from "idb-keyval";
import type { FormModel } from "./types";

const FORM_KEY = "form_state_v1";
const TOKEN_KEY = "auth_token_v1";

export async function saveForm(form: FormModel) {
  await set(FORM_KEY, form);
}
export async function loadForm(): Promise<FormModel | null> {
  return (await get(FORM_KEY)) ?? null;
}
export async function clearForm() {
  await del(FORM_KEY);
}

export async function saveToken(token: string | null) {
  if (token) await set(TOKEN_KEY, token);
  else await del(TOKEN_KEY);
}
export async function getToken(): Promise<string | null> {
  return (await get(TOKEN_KEY)) ?? null;
}

// Utility accessible from window for SW to read via idb in same origin DB.
export const DBPublic = { saveForm, loadForm, clearForm, saveToken, getToken };
