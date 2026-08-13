export interface OfficeSettings {
    id: string;

    companyName: string;
    tradeName?: string;

    cnpj: string;
    crc?: string;

    email: string;
    phone?: string;
    whatsapp?: string;

    website?: string;

    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;

    primaryColor: string;
    secondaryColor: string;

    logoUrl?: string;

    reportFooter?: string;
    digitalSignature?: string;

    createdAt: Date;
    updatedAt: Date;
}