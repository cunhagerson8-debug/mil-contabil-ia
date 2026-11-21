export const HR_PERMISSIONS = [
  "employee.read",
  "employee.sensitive.read",
  "employee.documents.read",
  "employee.manage",
  "employee.documents.manage",
] as const;

export type HrPermission = typeof HR_PERMISSIONS[number];

export interface HrCompanyPermissionGrant {
  companyId: string;
  permissions: HrPermission[];
}
