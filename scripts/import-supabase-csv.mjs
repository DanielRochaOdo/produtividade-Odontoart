import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'tabelas', 'tabelas');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLE_FILES = {
  profiles: 'profiles.csv',
  user_roles: 'user_roles.csv',
  competencias: 'competencias.csv',
  registros: 'registros.csv',
  audit_log: 'audit_log.csv',
};

const NUMERIC_FIELDS = {
  competencias: new Set(['mes', 'ano', 'registros_count', 'valor_total']),
  registros: new Set([
    'valor_procedimentos',
    'valor_glosa',
    'valor_lote',
    'valor_acerto',
    'valor_bruto',
    'pis',
    'cofins',
    'csll',
    'inss',
    'iss',
    'ir',
    'valor_liquido',
    'valor_pago',
    'qtde_procedimentos',
    'empresarial',
    'individual',
    'coletivo',
    'ortodontia',
  ]),
};

const NULLABLE_FIELDS = {
  competencias: new Set(['arquivo_nome', 'created_by']),
  registros: new Set([
    'lote',
    'data_gerado',
    'data_abertura',
    'codigo',
    'cnpj',
    'nome_titular',
    'banco',
    'conta_financeiro',
    'municipio',
    'uf',
    'bairro',
    'email',
    'telefone',
    'data_pagamento',
  ]),
  audit_log: new Set(['registro_id', 'user_id', 'valor_anterior', 'valor_novo']),
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      row.push(value);
      if (row.some((cell) => cell !== '')) {
        rows.push(row);
      }
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    if (row.some((cell) => cell !== '')) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const [header, ...dataRows] = rows;
  return dataRows.map((dataRow) => {
    const record = {};
    header.forEach((column, index) => {
      record[column] = dataRow[index] ?? '';
    });
    return record;
  });
}

async function readTableCsv(fileName) {
  const filePath = path.join(dataDir, fileName);
  const content = await fs.readFile(filePath, 'utf8');
  return parseCsv(content);
}

function convertValue(tableName, column, rawValue) {
  if (rawValue === '') {
    if (NULLABLE_FIELDS[tableName]?.has(column)) {
      return null;
    }
    return rawValue;
  }

  if (NUMERIC_FIELDS[tableName]?.has(column)) {
    return Number(rawValue);
  }

  return rawValue;
}

function convertRows(tableName, rows) {
  return rows.map((row) => {
    const converted = {};
    for (const [column, value] of Object.entries(row)) {
      converted[column] = convertValue(tableName, column, value);
    }
    return converted;
  });
}

async function listAllAuthUsers() {
  let page = 1;
  const users = [];

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const batch = data?.users ?? [];
    users.push(...batch);

    if (batch.length < 1000) {
      return users;
    }

    page += 1;
  }
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function upsertInChunks(tableName, rows, onConflict, chunkSize = 200) {
  if (rows.length === 0) {
    console.log(`- ${tableName}: no rows to import`);
    return;
  }

  for (const [index, batch] of chunk(rows, chunkSize).entries()) {
    const { error } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict, ignoreDuplicates: false });

    if (error) {
      throw new Error(`Failed to upsert ${tableName} batch ${index + 1}: ${error.message}`);
    }
  }

  console.log(`- ${tableName}: ${rows.length} rows imported`);
}

async function main() {
  const rawProfiles = await readTableCsv(TABLE_FILES.profiles);
  const rawUserRoles = await readTableCsv(TABLE_FILES.user_roles);
  const rawCompetencias = await readTableCsv(TABLE_FILES.competencias);
  const rawRegistros = await readTableCsv(TABLE_FILES.registros);
  const rawAuditLog = await readTableCsv(TABLE_FILES.audit_log);

  const profiles = convertRows('profiles', rawProfiles);
  const userRoles = convertRows('user_roles', rawUserRoles);
  const competencias = convertRows('competencias', rawCompetencias);
  const registros = convertRows('registros', rawRegistros);
  const auditLog = convertRows('audit_log', rawAuditLog);

  const existingUsers = await listAllAuthUsers();
  const existingByEmail = new Map(
    existingUsers
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user]),
  );

  const createdUsers = [];

  for (const profile of profiles) {
    const emailKey = profile.email.toLowerCase();
    if (existingByEmail.has(emailKey)) {
      continue;
    }

    const tempPassword = `Temp#${crypto.randomBytes(8).toString('hex')}`;
    const { data, error } = await supabase.auth.admin.createUser({
      email: profile.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        imported_from_csv: true,
        legacy_user_id: profile.id,
      },
    });

    if (error) {
      throw new Error(`Failed to create auth user for ${profile.email}: ${error.message}`);
    }

    if (!data.user?.email) {
      throw new Error(`Auth user creation for ${profile.email} returned no user email.`);
    }

    createdUsers.push({ email: data.user.email, id: data.user.id });
    existingByEmail.set(data.user.email.toLowerCase(), data.user);
  }

  if (createdUsers.length > 0) {
    console.log(`Created ${createdUsers.length} auth users.`);
  } else {
    console.log('No auth users needed creation.');
  }

  const allUsers = await listAllAuthUsers();
  const userByEmail = new Map(
    allUsers
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user]),
  );

  const legacyUserIdToNewId = new Map();
  for (const profile of profiles) {
    const authUser = userByEmail.get(profile.email.toLowerCase());
    if (!authUser) {
      throw new Error(`Auth user not found after creation for ${profile.email}`);
    }
    legacyUserIdToNewId.set(profile.id, authUser.id);
  }

  const mappedProfiles = profiles.map((profile) => ({
    ...profile,
    id: legacyUserIdToNewId.get(profile.id),
  }));

  const mappedUserRoles = userRoles.map((role) => ({
    user_id: legacyUserIdToNewId.get(role.user_id),
    role: role.role,
    created_at: role.created_at,
  }));

  const mappedCompetencias = competencias.map((competencia) => ({
    ...competencia,
    created_by: competencia.created_by
      ? (legacyUserIdToNewId.get(competencia.created_by) ?? null)
      : null,
  }));

  const mappedAuditLog = auditLog.map((entry) => ({
    ...entry,
    user_id: entry.user_id ? (legacyUserIdToNewId.get(entry.user_id) ?? null) : null,
  }));

  await upsertInChunks('profiles', mappedProfiles, 'id', 100);
  await upsertInChunks('user_roles', mappedUserRoles, 'user_id,role', 100);
  await upsertInChunks('competencias', mappedCompetencias, 'id', 100);
  await upsertInChunks('registros', registros, 'id', 200);
  await upsertInChunks('audit_log', mappedAuditLog, 'id', 100);

  const summary = {};
  for (const tableName of ['profiles', 'user_roles', 'competencias', 'registros', 'audit_log']) {
    const { count, error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
    if (error) {
      throw new Error(`Failed to count ${tableName}: ${error.message}`);
    }
    summary[tableName] = count ?? 0;
  }

  console.log('Final counts:', JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
