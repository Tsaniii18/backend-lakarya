import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface DatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  connectTimeout: number;
  acquireTimeout: number;
  ssl?:
    | boolean
    | {
        rejectUnauthorized: boolean;
        servername: string;
        ca?: string;
      };
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} wajib diisi ketika DATABASE_URL tidak digunakan.`,
    );
  }

  return value;
}

function positiveInteger(value: string | undefined, fallback: number, name: string) {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} harus berupa bilangan bulat positif.`);
  }

  return parsed;
}

function booleanEnvironment(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === '') return fallback;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;

  throw new Error('DB_SSL harus bernilai true atau false.');
}

function parseDatabaseUrl(value: string) {
  let databaseUrl: URL;

  try {
    databaseUrl = new URL(value);
  } catch {
    throw new Error('Konfigurasi database tidak membentuk URL yang valid.');
  }

  if (databaseUrl.protocol !== 'mysql:') {
    throw new Error('Koneksi database harus menggunakan protokol mysql://.');
  }

  if (
    !databaseUrl.hostname ||
    !databaseUrl.username ||
    !databaseUrl.pathname.slice(1)
  ) {
    throw new Error('Host, username, dan nama database wajib diisi.');
  }

  return databaseUrl;
}

export function getDatabaseUrl() {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  const usesSplitConfiguration = !configuredUrl;
  const databaseUrl = configuredUrl
    ? parseDatabaseUrl(configuredUrl)
    : new URL('mysql://localhost');

  if (usesSplitConfiguration) {
    databaseUrl.hostname = requiredEnvironment('DB_HOST');
    databaseUrl.port = String(
      positiveInteger(process.env.DB_PORT, 4000, 'DB_PORT'),
    );
    databaseUrl.username = requiredEnvironment('DB_USERNAME');
    databaseUrl.password = requiredEnvironment('DB_PASSWORD');
    databaseUrl.pathname = `/${requiredEnvironment('DB_DATABASE')}`;
  }

  const sslEnabled = booleanEnvironment(
    process.env.DB_SSL,
    usesSplitConfiguration || databaseUrl.searchParams.has('sslaccept'),
  );

  if (sslEnabled && !databaseUrl.searchParams.has('sslaccept')) {
    databaseUrl.searchParams.set('sslaccept', 'strict');
  }

  const caPath = process.env.DB_SSL_CA?.trim();
  if (sslEnabled && caPath && !databaseUrl.searchParams.has('sslcert')) {
    databaseUrl.searchParams.set('sslcert', caPath);
  }

  if (!sslEnabled) {
    databaseUrl.searchParams.delete('sslaccept');
    databaseUrl.searchParams.delete('sslcert');
  }

  return databaseUrl.toString();
}

export function getDatabaseConnectionConfig(): DatabaseConnectionConfig {
  const databaseUrl = parseDatabaseUrl(getDatabaseUrl());
  const sslAccept = databaseUrl.searchParams.get('sslaccept');
  const sslEnabled = booleanEnvironment(
    process.env.DB_SSL,
    sslAccept === 'strict' || sslAccept === 'accept_invalid_certs',
  );
  const caPath =
    process.env.DB_SSL_CA?.trim() || databaseUrl.searchParams.get('sslcert');
  const ssl = sslEnabled
    ? {
        rejectUnauthorized: sslAccept !== 'accept_invalid_certs',
        servername: databaseUrl.hostname,
        ...(caPath ? { ca: readFileSync(resolve(caPath), 'utf8') } : {}),
      }
    : undefined;

  return {
    host: databaseUrl.hostname,
    port: positiveInteger(databaseUrl.port, 3306, 'port database'),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: decodeURIComponent(databaseUrl.pathname.slice(1)),
    connectionLimit: positiveInteger(
      process.env.DB_CONNECTION_LIMIT,
      5,
      'DB_CONNECTION_LIMIT',
    ),
    connectTimeout: positiveInteger(
      process.env.DB_CONNECT_TIMEOUT,
      10_000,
      'DB_CONNECT_TIMEOUT',
    ),
    acquireTimeout: positiveInteger(
      process.env.DB_ACQUIRE_TIMEOUT,
      15_000,
      'DB_ACQUIRE_TIMEOUT',
    ),
    ...(ssl ? { ssl } : {}),
  };
}
