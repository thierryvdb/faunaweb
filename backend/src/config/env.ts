import { config } from 'dotenv';

config();

const env = {
  port: Number(process.env.PORT ?? 3333),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? 'changeme',
  pg: {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD ?? 'postgres',
    database: process.env.PGDATABASE ?? 'fauna'
  }
};

if (!env.databaseUrl && !env.pg) {
  throw new Error('Defina DATABASE_URL ou variaveis PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE');
}

if (!env.jwtSecret) {
  throw new Error('Defina JWT_SECRET');
}

export default env;
