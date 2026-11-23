const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_IMAGE_EXTENSION = /\.(?:png|jpe?g|webp)$/i;

export interface FirmIdentityRecord {
  id: string;
  name: string;
  trade_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
}

export interface FirmIdentityDto {
  name: string;
  tradeName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}

export function toFirmIdentityDto(
  identity: FirmIdentityRecord,
  authenticatedFirmId: string,
): FirmIdentityDto {
  return {
    name: identity.name,
    tradeName: identity.trade_name,
    logoUrl: safeFirmLogoPath(identity.logo_url, authenticatedFirmId),
    primaryColor: safeFirmPrimaryColor(identity.primary_color),
  };
}

export function safeFirmLogoPath(value: string | null, firmId: string): string | null {
  if (!value || !UUID_PATTERN.test(firmId)) return null;

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
    || !SAFE_IMAGE_EXTENSION.test(relativePath)
  ) {
    return null;
  }

  return value;
}

export function safeFirmPrimaryColor(value: string | null): string | null {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}
