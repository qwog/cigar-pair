import { currentCsrfToken } from "@/lib/auth";

/** Hidden double-submit token; every mutating form includes one. */
export async function CsrfField() {
  const token = await currentCsrfToken();
  return <input type="hidden" name="csrf" value={token} />;
}
