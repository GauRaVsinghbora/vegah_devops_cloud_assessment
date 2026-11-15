import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { SecureContextOptions } from 'node:tls';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

export type MariaDbAdapterOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  acquireTimeout: number;
  connectTimeout: number;
  idleTimeout: number;
  socketPath?: string;
  socketTimeout?: number;
  ssl?: SecureContextOptions & { rejectUnauthorized?: boolean };
};

const supportedQueryOptions = new Set([
  'connection_limit',
  'connect_timeout',
  'pool_timeout',
  'socket',
  'socket_timeout',
  'ssl',
  'sslaccept',
  'sslcert',
  'sslidentity',
  'sslpassword',
]);

export function parseMysqlConnectionUrl(databaseUrl: string): MariaDbAdapterOptions {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL must use the mysql:// scheme');
  }

  const database = decodeURIComponent(url.pathname.slice(1));
  if (!url.hostname || !database) {
    throw new Error('DATABASE_URL must include a MySQL host and database name');
  }

  const unsupportedOptions = [...url.searchParams.keys()]
    .filter((name) => !supportedQueryOptions.has(name));
  if (unsupportedOptions.length > 0) {
    throw new Error(`Unsupported DATABASE_URL option(s): ${unsupportedOptions.join(', ')}`);
  }

  const options: MariaDbAdapterOptions = {
    host: url.hostname.startsWith('[') && url.hostname.endsWith(']')
      ? url.hostname.slice(1, -1)
      : url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: parsePositiveInteger(url.searchParams.get('connection_limit'), 10, 'connection_limit'),
    acquireTimeout: parseSeconds(url.searchParams.get('pool_timeout'), 10_000, 'pool_timeout'),
    connectTimeout: parseSeconds(url.searchParams.get('connect_timeout'), 5_000, 'connect_timeout'),
    idleTimeout: 300,
  };

  const socketPath = url.searchParams.get('socket');
  if (socketPath !== null) options.socketPath = socketPath;

  const socketTimeout = url.searchParams.get('socket_timeout');
  if (socketTimeout !== null) {
    options.socketTimeout = parseSeconds(socketTimeout, 0, 'socket_timeout');
  }

  options.ssl = parseSslOptions(url);
  return options;
}

export function createMariaDbAdapter(databaseUrl: string): PrismaMariaDb {
  return new PrismaMariaDb(parseMysqlConnectionUrl(databaseUrl));
}

function parseSslOptions(url: URL): MariaDbAdapterOptions['ssl'] {
  const acceptMode = url.searchParams.get('sslaccept');
  if (acceptMode !== null && !['strict', 'accept_invalid_certs'].includes(acceptMode)) {
    throw new Error('DATABASE_URL sslaccept must be strict or accept_invalid_certs');
  }

  const sslValue = url.searchParams.get('ssl');
  if (sslValue !== null && sslValue !== 'true' && sslValue !== 'false') {
    throw new Error('DATABASE_URL ssl must be true or false');
  }

  const certificatePath = url.searchParams.get('sslcert');
  const identityPath = url.searchParams.get('sslidentity');
  const passphrase = url.searchParams.get('sslpassword');
  const hasTlsMaterial = certificatePath !== null || identityPath !== null || acceptMode !== null;

  if (sslValue === 'false' && hasTlsMaterial) {
    throw new Error('DATABASE_URL cannot disable ssl while TLS options are configured');
  }
  if (passphrase !== null && identityPath === null) {
    throw new Error('DATABASE_URL sslpassword requires sslidentity');
  }

  if (sslValue !== 'true' && !hasTlsMaterial) {
    return undefined;
  }

  const options: NonNullable<MariaDbAdapterOptions['ssl']> = {
    rejectUnauthorized: acceptMode === 'strict' || (acceptMode === null && sslValue === 'true'),
  };
  if (certificatePath) options.ca = readFileSync(resolvePrismaPath(certificatePath));
  if (identityPath) options.pfx = readFileSync(resolvePrismaPath(identityPath));
  if (passphrase !== null) options.passphrase = passphrase;
  return options;
}

function resolvePrismaPath(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), 'prisma', path);
}

function parsePositiveInteger(value: string | null, defaultValue: number, name: string): number {
  if (value === null) return defaultValue;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`DATABASE_URL ${name} must be a positive integer`);
  }
  return parsed;
}

function parseSeconds(value: string | null, defaultMilliseconds: number, name: string): number {
  if (value === null) return defaultMilliseconds;
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > Number.MAX_SAFE_INTEGER / 1000) {
    throw new Error(`DATABASE_URL ${name} must be a non-negative integer number of seconds`);
  }
  return seconds * 1000;
}
