import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.config.get<string>('redis.host'),
      port: this.config.get<number>('redis.port'),
      password: this.config.get<string>('redis.password'),
      db: this.config.get<number>('redis.db'),
      keyPrefix: this.config.get<string>('redis.keyPrefix'),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, payload, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, payload);
    }
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  /**
   * Delete every key matching a pattern (uses SCAN to avoid blocking).
   * Pattern is matched against the *suffix* portion (the global keyPrefix is auto-applied by ioredis on writes,
   * so for SCAN we must include the prefix explicitly).
   */
  async delByPattern(pattern: string): Promise<number> {
    const fullPattern = `${this.config.get<string>('redis.keyPrefix') ?? ''}${pattern}`;
    let cursor = '0';
    let total = 0;
    do {
      const [next, batch] = await this.client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 200);
      cursor = next;
      if (batch.length) {
        // SCAN returns full keys (with prefix already), so use unprefixed deletion via the underlying client.
        total += await this.client.unlink(...batch);
      }
    } while (cursor !== '0');
    return total;
  }

  /**
   * Cache-aside helper: returns cached value or computes + stores it.
   */
  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
