export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
}

export interface JwtConfig {
  secret: string;
  algorithm: string;
  expiresIn: string;
  issuer?: string;
  audience?: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
}

export interface RateLimitConfig {
  ttlSeconds: number;
  max: number;
}

export interface CacheTtlConfig {
  dashboard: number;
  financeSummary: number;
  user: number;
}

export interface SeedConfig {
  secret?: string;
}

export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.GLOBAL_API_PREFIX ?? 'api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
  } as AppConfig,
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    algorithm: process.env.JWT_ALGORITHM ?? 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  } as JwtConfig,
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'hisab247:',
  } as RedisConfig,
  rateLimit: {
    ttlSeconds: Number(process.env.RATE_LIMIT_TTL_SECONDS ?? 60),
    max: Number(process.env.RATE_LIMIT_MAX ?? 120),
  } as RateLimitConfig,
  cacheTtl: {
    dashboard: Number(process.env.CACHE_TTL_DASHBOARD ?? 60),
    financeSummary: Number(process.env.CACHE_TTL_FINANCE_SUMMARY ?? 120),
    user: Number(process.env.CACHE_TTL_USER ?? 300),
  } as CacheTtlConfig,
  seed: {
    secret: process.env.SEED_SECRET || undefined,
  } as SeedConfig,
});
