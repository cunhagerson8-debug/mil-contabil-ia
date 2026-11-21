export interface PublicCommercialLeadInput {
  name: string;
  whatsapp: string;
  email?: string;
  serviceInterest: "software_subscription" | "accounting_services" | "both" | "undecided";
  voluntaryDetails?: string;
  consent: true;
  website?: string;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL ?? window.location.origin;

export async function submitPublicCommercialLead(
  input: PublicCommercialLeadInput,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/public/mila/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("Não foi possível enviar agora. Confira sua conexão e tente novamente.");
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = data && typeof data === "object" && "error" in data
      && typeof data.error === "string"
      ? data.error
      : "Não foi possível enviar agora. Tente novamente mais tarde.";
    throw new Error(errorMessage);
  }

  if (!data || typeof data !== "object" || !("accepted" in data) || data.accepted !== true) {
    throw new Error("Não foi possível confirmar o recebimento. Tente novamente mais tarde.");
  }
}
