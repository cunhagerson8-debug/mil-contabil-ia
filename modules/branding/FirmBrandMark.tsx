import { useState } from "react";
import { getSafeFirmLogoUrl, getSafeFirmPrimaryColor } from "../../services/firmIdentityApi";

interface FirmBrandMarkProps {
  firmId: string | null;
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  officialMil?: boolean;
  size: "sidebar" | "header";
}

export default function FirmBrandMark({
  firmId,
  name,
  logoUrl,
  primaryColor,
  officialMil = false,
  size,
}: FirmBrandMarkProps) {
  const safeLogoUrl = officialMil
    ? "/images/logo-mil-contabil-ia.png"
    : getSafeFirmLogoUrl(logoUrl, firmId, window.location.origin);
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const showLogo = safeLogoUrl !== null && safeLogoUrl !== failedLogo;
  const safeColor = getSafeFirmPrimaryColor(primaryColor);
  const sizeClass = size === "sidebar" ? "h-12 w-12" : "h-8 w-8";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "E";

  return (
    <span
      role="img"
      aria-label={`${name} — identidade visual`}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border ${
        showLogo ? "border-transparent bg-white" : "border-blue-100 bg-blue-50"
      } ${sizeClass}`}
      style={!showLogo && safeColor ? {
        borderColor: `${safeColor}55`,
        backgroundColor: `${safeColor}14`,
        color: safeColor,
      } : undefined}
    >
      {showLogo ? (
        <img
          src={safeLogoUrl}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain p-1"
          onError={() => setFailedLogo(safeLogoUrl)}
        />
      ) : (
        <span className={`font-black ${size === "sidebar" ? "text-sm" : "text-[10px]"}`}>
          {initials}
        </span>
      )}
    </span>
  );
}
