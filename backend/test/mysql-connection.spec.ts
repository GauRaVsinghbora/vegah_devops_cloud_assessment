import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseMysqlConnectionUrl } from '../src/prisma/mysql-connection';

describe('MySQL adapter connection URL', () => {
  it('decodes credentials and maps pool and TLS options', () => {
    const directory = mkdtempSync(join(tmpdir(), 'smarturl-mysql-'));
    const caPath = join(directory, 'ca.pem');
    const identityPath = join(directory, 'client.p12');
    writeFileSync(caPath, 'test-ca');
    writeFileSync(identityPath, 'test-identity');

    try {
      const options = parseMysqlConnectionUrl(
        `mysql://smart%40url:p%40ss%3Aword@db.example:3307/smart%2Durl`
        + `?connection_limit=6&connect_timeout=8&pool_timeout=12&socket_timeout=15`
        + `&sslaccept=strict&sslcert=${encodeURIComponent(caPath)}`
        + `&sslidentity=${encodeURIComponent(identityPath)}&sslpassword=p%40ss%2Bphrase`,
      );

      expect(options).toMatchObject({
        host: 'db.example',
        port: 3307,
        user: 'smart@url',
        password: 'p@ss:word',
        database: 'smart-url',
        connectionLimit: 6,
        connectTimeout: 8000,
        acquireTimeout: 12000,
        socketTimeout: 15000,
        idleTimeout: 300,
        ssl: {
          rejectUnauthorized: true,
          ca: Buffer.from('test-ca'),
          pfx: Buffer.from('test-identity'),
          passphrase: 'p@ss+phrase',
        },
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects unsupported TLS modes instead of silently weakening the connection', () => {
    expect(() => parseMysqlConnectionUrl(
      'mysql://user:password@localhost:3306/smarturl?sslaccept=unknown',
    )).toThrow('DATABASE_URL sslaccept must be strict or accept_invalid_certs');
  });

  it('preserves Prisma 6 TLS acceptance defaults when sslaccept is omitted', () => {
    const directory = mkdtempSync(join(tmpdir(), 'smarturl-mysql-'));
    const caPath = join(directory, 'ca.pem');
    writeFileSync(caPath, 'test-ca');
    try {
      const options = parseMysqlConnectionUrl(
        `mysql://user:password@localhost:3306/smarturl?sslcert=${encodeURIComponent(caPath)}`,
      );
      expect(options.ssl?.rejectUnauthorized).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('uses explicit conservative pool defaults when the URL has no options', () => {
    expect(parseMysqlConnectionUrl('mysql://user:password@localhost:3306/smarturl')).toMatchObject({
      connectionLimit: 10,
      acquireTimeout: 10_000,
      connectTimeout: 5_000,
      idleTimeout: 300,
    });
  });
});
