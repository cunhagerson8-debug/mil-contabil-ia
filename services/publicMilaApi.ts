export interface PublicMilaMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PublicMilaChatInput {
  message: string;
  history: PublicMilaMessage[];
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL ?? window.location.origin;

export async function sendMilaMessage(input: PublicMilaChatInput): Promise<{ response: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/public/mila/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("Não foi possível conectar com a Mila agora. Tente novamente mais tarde.");
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = data && typeof data === "object" && "error" in data
      && typeof data.error === "string"
      ? data.error
      : response.status === 429
        ? "Muitas mensagens em pouco tempo. Aguarde um momento e tente novamente."
        : "A Mila está indisponível neste momento. Tente novamente mais tarde.";
    throw new Error(errorMessage);
  }

  if (!data || typeof data !== "object" || !("response" in data) || typeof data.response !== "string") {
    throw new Error("A Mila não conseguiu responder agora. Tente novamente mais tarde.");
  }

  return { response: data.response };
}
