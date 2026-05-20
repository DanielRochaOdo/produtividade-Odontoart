import type { Registro } from "@/lib/queries";
import { normalizeText } from "@/lib/text-normalization";

export type PaymentScope = "all" | "interno" | "externo";

export const PAYMENT_SCOPE_OPTIONS: { value: PaymentScope; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "interno", label: "Interno" },
  { value: "externo", label: "Externo" },
];

export function getPaymentScope(value: string | null | undefined): Exclude<PaymentScope, "all"> | null {
  const normalized = normalizeText(value);
  if (normalized.includes("EXTERN")) return "externo";
  if (normalized.includes("ODONTOMOVEL")) return "interno";
  if (normalized.includes("INTERN")) return "interno";
  return null;
}

export function filterRegistrosByPaymentScope<T extends Pick<Registro, "conta_financeiro">>(
  registros: T[],
  scope: PaymentScope,
) {
  if (scope === "all") return registros;
  return registros.filter((registro) => getPaymentScope(registro.conta_financeiro) === scope);
}
