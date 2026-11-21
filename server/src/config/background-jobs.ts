export function areBackgroundJobsDisabled(value: string | undefined): boolean {
  return value === "true";
}

export function startBackgroundJobsIfEnabled(disabled: boolean, start: () => void): void {
  if (!disabled) start();
}
