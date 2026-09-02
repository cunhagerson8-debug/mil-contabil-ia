import { pool } from "../db/pool.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function recalculateObligationStatuses(): Promise<void> {
  try {
    await pool.query("SELECT recalculate_obligation_statuses();");

    console.log(
      "[obligation-status-job] Status das obrigações recalculados com sucesso."
    );
  } catch (error) {
    console.error(
      "[obligation-status-job] Erro ao recalcular status das obrigações:",
      error
    );
  }
}

export function startObligationStatusJob(): NodeJS.Timeout {
  void recalculateObligationStatuses();

  const interval = setInterval(() => {
    void recalculateObligationStatuses();
  }, ONE_DAY_MS);

  console.log(
    "[obligation-status-job] Job diário de obrigações iniciado."
  );

  return interval;
}