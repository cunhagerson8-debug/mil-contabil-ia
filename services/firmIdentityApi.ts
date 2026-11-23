import { apiRequest } from "./apiClient";

export interface FirmIdentity {
  name: string;
  tradeName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}

export async function getMyFirmIdentity(): Promise<FirmIdentity> {
  const { identity } = await apiRequest<{ identity: FirmIdentity }>("/api/firms/identity");
  return identity;
}

export function getSafeFirmLogoUrl(
  value: string | null | undefined,
  firmId: string | null | undefined,
  origin: string,
): string | null {
  if (!value || !firmId || !/^[0-9a-f-]{36}$/i.test(firmId)) return null;

  const prefix = `/uploads/firms/${firmId}/`;
  if (!value.startsWith(prefix) || value.includes("\\") || /[%?#\u0000-\u001f]/.test(value)) {
    return null;
  }

  const relativePath = value.slice(prefix.length);
  const segments = relativePath.split("/");
  if (
    !relativePath
    || segments.some((segment) => !segment || segment === "." || segment === "..")
    || !/^[A-Za-z0-9._/-]+$/.test(relativePath)
    || !/\.(?:png|jpe?g|webp)$/i.test(relativePath)
  ) {
    return null;
  }

  try {
    const url = new URL(value, origin);
    if (url.origin !== new URL(origin).origin || url.search || url.hash) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

export function getSafeFirmPrimaryColor(value: string | null | undefined): string | undefined {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
}
