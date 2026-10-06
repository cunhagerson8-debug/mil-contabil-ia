import { env } from "../config/env.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const EMAIL_FROM = "MIL Contábil IA <noreply@milcontabilia.com.br>";
const APP_BASE_URL = "https://milcontabilia.com.br";
const REQUEST_TIMEOUT_MS = 10_000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// O frontend (App.tsx / InviteAcceptPage) lê o query param `invite` na raiz.
function buildInviteUrl(token: string): string {
  return `${APP_BASE_URL}/?invite=${encodeURIComponent(token)}`;
}

interface InviteEmailData {
  to: string;
  fullName: string;
  token: string;
  expiresAt: Date;
}

function renderInviteEmail({ fullName, token, expiresAt }: InviteEmailData) {
  const url = buildInviteUrl(token);
  const name = escapeHtml(fullName);
  const expires = expiresAt.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;padding:32px;">
        <tr><td>
          <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">MIL Contábil IA</h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Olá, ${name}!</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">Você foi convidado para acessar a plataforma MIL Contábil IA.</p>
          <p style="margin:0 0 24px;"><a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;font-size:15px;">Aceitar convite</a></p>
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Este convite é válido até ${expires} (horário de Brasília). Após esse prazo, solicite um novo convite.</p>
          <p style="margin:0;font-size:13px;color:#6b7280;word-break:break-all;">Se o botão não funcionar, copie e cole este link no navegador:<br>${url}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    "MIL Contábil IA",
    "",
    `Olá, ${fullName}!`,
    "Você foi convidado para acessar a plataforma MIL Contábil IA.",
    "",
    `Aceite o convite: ${url}`,
    "",
    `Este convite é válido até ${expires} (horário de Brasília). Após esse prazo, solicite um novo convite.`,
  ].join("\n");

  return { html, text };
}

export class EmailDeliveryError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

async function sendEmail(params: { to: string; subject: string; html: string; text: string }): Promise<void> {
  if (!env.resendApiKey) {
    throw new EmailDeliveryError("RESEND_API_KEY não configurada.");
  }

  let response: Response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: EMAIL_FROM, ...params, to: [params.to] }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.name : "unknown";
    throw new EmailDeliveryError(`Falha de rede ao chamar o Resend (${reason}).`);
  }

  if (!response.ok) {
    let code = "";
    try {
      const body = (await response.json()) as { name?: unknown };
      if (typeof body.name === "string") code = body.name.slice(0, 64);
    } catch {
      // corpo não-JSON: ignora, apenas o status é registrado
    }
    throw new EmailDeliveryError(`Resend recusou o envio (status ${response.status}${code ? `, ${code}` : ""}).`, response.status);
  }
}

export const emailService = {
  async sendInvitationEmail(data: InviteEmailData): Promise<void> {
    const { html, text } = renderInviteEmail(data);
    await sendEmail({
      to: data.to,
      subject: "Você foi convidado para a MIL Contábil IA",
      html,
      text,
    });
  },
};
