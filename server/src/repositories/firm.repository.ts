import type { PoolClient } from "pg";

export interface FirmRow {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj: string;
  status: string;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  primary_color: string | null;
  timezone: string | null;
  trial_ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateFirmInput {
  name: string;
  trade_name?: string | null;
  cnpj: string;
  status?: string;
  email?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  timezone?: string | null;
  trial_ends_at?: Date | null;
}

export interface UpdateFirmInput {
  name?: string;
  trade_name?: string | null;
  cnpj?: string;
  status?: string;
  email?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  timezone?: string | null;
  trial_ends_at?: Date | null;
}

export async function createFirm(
  client: PoolClient,
  input: CreateFirmInput
): Promise<FirmRow> {
  const result = await client.query<FirmRow>(
    `
      INSERT INTO firms (
        name,
        trade_name,
        cnpj,
        status,
        email,
        phone,
        logo_url,
        primary_color,
        timezone,
        trial_ends_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10
      )
      RETURNING
        id,
        name,
        trade_name,
        cnpj,
        status,
        email,
        phone,
        logo_url,
        primary_color,
        timezone,
        trial_ends_at,
        created_at,
        updated_at,
        deleted_at
    `,
    [
      input.name,
      input.trade_name ?? null,
      input.cnpj,
      input.status ?? "trial",
      input.email ?? null,
      input.phone ?? null,
      input.logo_url ?? null,
      input.primary_color ?? null,
      input.timezone ?? "America/Sao_Paulo",
      input.trial_ends_at ?? null,
    ]
  );

  return result.rows[0];
}

export async function findFirmById(
  client: PoolClient,
  firmId: string
): Promise<FirmRow | null> {
  const result = await client.query<FirmRow>(
    `
      SELECT
        id,
        name,
        trade_name,
        cnpj,
        status,
        email,
        phone,
        logo_url,
        primary_color,
        timezone,
        trial_ends_at,
        created_at,
        updated_at,
        deleted_at
      FROM firms
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [firmId]
  );

  return result.rows[0] ?? null;
}

export async function findFirmByCnpj(
  client: PoolClient,
  cnpj: string
): Promise<FirmRow | null> {
  const result = await client.query<FirmRow>(
    `
      SELECT
        id,
        name,
        trade_name,
        cnpj,
        status,
        email,
        phone,
        logo_url,
        primary_color,
        timezone,
        trial_ends_at,
        created_at,
        updated_at,
        deleted_at
      FROM firms
      WHERE cnpj = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [cnpj]
  );

  return result.rows[0] ?? null;
}

export async function listFirms(
  client: PoolClient
): Promise<FirmRow[]> {
  const result = await client.query<FirmRow>(
    `
      SELECT
        id,
        name,
        trade_name,
        cnpj,
        status,
        email,
        phone,
        logo_url,
        primary_color,
        timezone,
        trial_ends_at,
        created_at,
        updated_at,
        deleted_at
      FROM firms
      WHERE deleted_at IS NULL
      ORDER BY name ASC
    `
  );

  return result.rows;
}

export async function updateFirm(
  client: PoolClient,
  firmId: string,
  input: UpdateFirmInput
): Promise<FirmRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  const addField = (column: string, value: unknown) => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (input.name !== undefined) {
    addField("name", input.name);
  }

  if (input.trade_name !== undefined) {
    addField("trade_name", input.trade_name);
  }

  if (input.cnpj !== undefined) {
    addField("cnpj", input.cnpj);
  }

  if (input.status !== undefined) {
    addField("status", input.status);
  }

  if (input.email !== undefined) {
    addField("email", input.email);
  }

  if (input.phone !== undefined) {
    addField("phone", input.phone);
  }

  if (input.logo_url !== undefined) {
    addField("logo_url", input.logo_url);
  }

  if (input.primary_color !== undefined) {
    addField("primary_color", input.primary_color);
  }

  if (input.timezone !== undefined) {
    addField("timezone", input.timezone);
  }

  if (input.trial_ends_at !== undefined) {
    addField("trial_ends_at", input.trial_ends_at);
  }

  if (fields.length === 0) {
    return findFirmById(client, firmId);
  }

  values.push(firmId);

  const result = await client.query<FirmRow>(
    `
      UPDATE firms
      SET
        ${fields.join(", ")},
        updated_at = now()
      WHERE id = $${values.length}
        AND deleted_at IS NULL
      RETURNING
        id,
        name,
        trade_name,
        cnpj,
        status,
        email,
        phone,
        logo_url,
        primary_color,
        timezone,
        trial_ends_at,
        created_at,
        updated_at,
        deleted_at
    `,
    values
  );

  return result.rows[0] ?? null;
}

export async function softDeleteFirm(
  client: PoolClient,
  firmId: string
): Promise<boolean> {
  const result = await client.query(
    `
      UPDATE firms
      SET
        deleted_at = now(),
        updated_at = now()
      WHERE id = $1
        AND deleted_at IS NULL
    `,
    [firmId]
  );

  return (result.rowCount ?? 0) > 0;
}