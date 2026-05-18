# NestJS Production Backend — Project Blueprint

A copy-paste prompt to bootstrap a new NestJS project with the **same architecture, conventions, and building blocks** as this repo. The blueprint includes:

- Multi-tenant JWT auth (email + password, bcrypt, 7d expiry)
- Prisma + PostgreSQL with idempotent seed API
- Redis caching layer with cache-aside helper
- Standard response envelope, exception filter, request logging
- Role-based access control + tenant isolation guards
- Global validation, throttling, helmet, compression, Swagger
- One worked example module (`Posts`) — copy it to add any new resource

> **How to use this file.** Paste the entire contents into a fresh Claude Code conversation with the instruction: *"Set up a NestJS backend exactly as described in this blueprint. Project name: `<your-name>`. Replace the Posts example with my actual first module: `<your-module>`."*

---

## 1. Tech stack & dependencies

| Concern | Choice |
|---|---|
| Framework | NestJS 10 |
| Runtime | Node ≥ 20 |
| Language | TypeScript (strictNullChecks on, noImplicitAny off) |
| DB | PostgreSQL via Prisma 5 |
| Cache | Redis via ioredis |
| Auth | `@nestjs/jwt` (HS256, 7d) + `bcryptjs` |
| Validation | `class-validator` + `class-transformer` |
| Docs | `@nestjs/swagger` (disabled in prod unless `ENABLE_SWAGGER=true`) |
| Security | `helmet`, `compression`, `@nestjs/throttler` |
| Logs | `nestjs-pino` |

```bash
npm i @nestjs/common @nestjs/config @nestjs/core @nestjs/jwt @nestjs/platform-express \
      @nestjs/swagger @nestjs/throttler @prisma/client bcryptjs class-transformer \
      class-validator compression helmet ioredis nestjs-pino pino-http pino-pretty \
      reflect-metadata rxjs

npm i -D @nestjs/cli @nestjs/schematics @nestjs/testing @types/bcryptjs @types/compression \
        @types/express @types/jest @types/jsonwebtoken @types/node dotenv \
        @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint \
        eslint-config-prettier eslint-plugin-prettier jest prettier prisma \
        source-map-support supertest ts-jest ts-loader ts-node tsconfig-paths typescript
```

---

## 2. Folder structure

```
.
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                       # CLI seed (mirrors src/modules/admin/seed.service.ts)
├── src/
│   ├── config/
│   │   └── configuration.ts          # Typed env loader
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   ├── current-user.decorator.ts
│   │   │   └── store-id.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── store-isolation.guard.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── interceptors/
│   │   │   ├── response.interceptor.ts
│   │   │   └── logging.interceptor.ts
│   │   ├── types/
│   │   │   └── auth-user.ts
│   │   └── utils/
│   │       ├── pagination.ts
│   │       ├── public-id.ts
│   │       └── cache-keys.ts
│   ├── prisma/
│   │   ├── prisma.module.ts          # @Global
│   │   └── prisma.service.ts
│   ├── redis/
│   │   ├── redis.module.ts           # @Global
│   │   └── redis.service.ts          # get/set/del/wrap/delByPattern
│   ├── modules/
│   │   ├── auth/                     # POST /auth/login, GET /auth/me
│   │   ├── admin/                    # POST /admin/seed (header-secret guarded)
│   │   └── posts/                    # <-- worked example feature module
│   ├── app.module.ts
│   └── main.ts
├── .env.example
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── nest-cli.json
```

---

## 3. Environment variables

`.env.example`:

```env
NODE_ENV=development
PORT=3000
GLOBAL_API_PREFIX=api/v1
CORS_ORIGINS=*

DATABASE_URL=postgresql://user:pass@localhost:5432/appdb?schema=public

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=app:

JWT_SECRET=<openssl rand -hex 32>
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=7d
# JWT_ISSUER=
# JWT_AUDIENCE=

RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_MAX=120

CACHE_TTL_DASHBOARD=60
CACHE_TTL_USER=300

SEED_SECRET=<openssl rand -hex 32>   # required to call POST /admin/seed
ENABLE_SWAGGER=true                  # auto-on outside production
```

---

## 4. Core configuration

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": false,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true
  },
  "exclude": ["node_modules", "dist"]
}
```

### `tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "test", "dist", "scripts", "prisma", "**/*.spec.ts"]
}
```

### `src/config/configuration.ts`

```ts
export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.GLOBAL_API_PREFIX ?? 'api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    algorithm: process.env.JWT_ALGORITHM ?? 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'app:',
  },
  rateLimit: {
    ttlSeconds: Number(process.env.RATE_LIMIT_TTL_SECONDS ?? 60),
    max: Number(process.env.RATE_LIMIT_MAX ?? 120),
  },
  cacheTtl: {
    user: Number(process.env.CACHE_TTL_USER ?? 300),
  },
  seed: { secret: process.env.SEED_SECRET || undefined },
});
```

### `src/main.ts`

Bootstrap exactly like this — global pipe, filter, interceptor, helmet, compression, Swagger:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const port = Number(process.env.PORT ?? 3000);
  const prefix = process.env.GLOBAL_API_PREFIX ?? 'api/v1';
  const corsOrigins = (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim());

  app.setGlobalPrefix(prefix);
  app.enableCors({ origin: corsOrigins.includes('*') ? true : corsOrigins, credentials: true });
  app.use(helmet());
  app.use(compression());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableShutdownHooks();

  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('App API').setVersion('1.0').addBearerAuth().build();
    SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`listening on :${port}/${prefix}`);
}
bootstrap();
```

### `src/app.module.ts`

Register **four global guards** in this order (Throttler → JwtAuth → Roles → StoreIsolation):

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { StoreIsolationGuard } from './common/guards/store-isolation.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { PostsModule } from './modules/posts/posts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], cache: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => [{
        ttl: c.get<number>('rateLimit.ttlSeconds')! * 1000,
        limit: c.get<number>('rateLimit.max')!,
      }],
    }),
    PrismaModule, RedisModule, AuthModule, AdminModule, PostsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: StoreIsolationGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
```

---

## 5. Prisma schema (skeleton)

`prisma/schema.prisma` — multi-tenant: every business table carries `storeId`, has `createdAt/updatedAt/deletedAt`, soft-deletes via `deletedAt`.

```prisma
generator client { provider = "prisma-client-js" }
datasource db    { provider = "postgresql"; url = env("DATABASE_URL") }

enum UserRole { ADMIN MANAGER STAFF }

model Store {
  id        String   @id @default(cuid())
  publicId  String   @unique
  name      String
  ownerId   String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  users     User[]
  posts     Post[]
  @@map("stores")
}

model User {
  id        String   @id @default(cuid())
  email     String?  @unique
  password  String?               // bcrypt hash
  name      String?
  role      UserRole @default(STAFF)
  storeId   String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  store     Store?   @relation(fields: [storeId], references: [id], onDelete: Cascade)
  @@map("users")
}

// ============ Example domain model ============
model Post {
  id        String   @id @default(cuid())
  publicId  String                // 6-digit, unique within store
  storeId   String
  title     String
  body      String?
  isActive  Boolean  @default(true)
  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  @@unique([storeId, publicId])
  @@index([storeId, createdAt(sort: Desc)])
  @@index([deletedAt])
  @@map("posts")
}
```

---

## 6. Shared building blocks

### `src/common/types/auth-user.ts`

```ts
import { UserRole } from '@prisma/client';
export interface AuthUser {
  userId: string;
  email?: string;
  role: UserRole;
  storeId: string;
}
```

### Decorators

```ts
// public.decorator.ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user: AuthUser = ctx.switchToHttp().getRequest().user;
    return data ? user?.[data] : user;
  },
);

// store-id.decorator.ts — throws if missing (defense-in-depth)
export const StoreId = createParamDecorator((_, ctx: ExecutionContext): string => {
  const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
  if (!user?.storeId) throw new ForbiddenException('Missing storeId');
  return user.storeId;
});
```

### Guards

**`jwt-auth.guard.ts`** — verifies Bearer token, attaches `req.user`, honors `@Public()`. Token payload **must** include `sub`, `email`, `role`, `storeId`.

**`roles.guard.ts`** — checks `req.user.role ∈ @Roles(...)` metadata; pass-through if no roles set.

**`store-isolation.guard.ts`** — rejects requests whose body/params/query carry a `storeId` that doesn't match `req.user.storeId`. Honors `@Public()`.

### Filter — `http-exception.filter.ts`

Maps `HttpException`, `Prisma.PrismaClientKnownRequestError` (P2002→409, P2025→404), and unknown errors to a uniform JSON shape:

```json
{
  "success": false,
  "statusCode": 409,
  "path": "/api/v1/...",
  "method": "POST",
  "timestamp": "...",
  "error": { "message": "...", "code": "P2002" }
}
```

### Interceptors

**`response.interceptor.ts`** — wraps every success response:

```json
{ "success": true, "statusCode": 200, "data": <handler return>, "timestamp": "..." }
```

A handler may return `{ message, data, meta }` to set headline fields; otherwise the raw return becomes `data`. Already-shaped envelopes pass through.

**`logging.interceptor.ts`** — logs `METHOD URL ms user=… store=…` per request.

### Utilities

```ts
// pagination.ts — PaginationDto + buildPage<T>
class PaginationDto { page=1; limit=20; get skip(){...}; get take(){...} }
buildPage<T>(rows, total, p) => { data, meta: { page, limit, total, totalPages } }

// public-id.ts — 6-digit numeric public ID + service-layer retry on collision
generatePublicId(): string  // "100000".."999999"

// cache-keys.ts — centralised key shapes
CacheKeys.user(userId), CacheKeys.storeAll(storeId), ...
```

---

## 7. Auth module

### Files
- `auth.module.ts` — `@Global`, `JwtModule.registerAsync` with `signOptions.expiresIn: '7d'` and throws if `JWT_SECRET` is missing.
- `auth.service.ts` — Prisma user lookup, `bcrypt.compare`, signs `{ sub, email, role, storeId }`.
- `auth.controller.ts` — `POST /auth/login` (`@Public()`, 200), `GET /auth/me`.
- `dto/login.dto.ts` — `@IsEmail` + `@MinLength(6)`, email is trimmed/lowercased via `@Transform`.

### Login flow

```
POST /auth/login  { email, password }
  → ValidationPipe (DTO)
  → Prisma.user.findFirst({ email, deletedAt: null })
  → bcrypt.compare
  → JwtService.signAsync({ sub, email, role, storeId }, { expiresIn: '7d' })
  → 200 { accessToken, user: { id, email, role } }

GET /auth/me  Authorization: Bearer <token>
  → JwtAuthGuard verifies, attaches req.user
  → 200 { id, email, role }
```

### Security rules
- Use generic `"Invalid email or password"` for both missing-user and bad-password (no enumeration).
- Reject `isActive=false` accounts AFTER password check.
- Reject users without `storeId` (multi-tenant invariant).
- `signOptions.algorithm` matches `verifyOptions.algorithms[0]` (HS256 default).
- Never log the password or the hash.

---

## 8. Admin / Seed module

A production-safe seed endpoint:

- `POST /admin/seed` — `@Public()` + `SeedSecretGuard` (constant-time header comparison via `crypto.timingSafeEqual`).
- Returns **404** (not 401) on missing/wrong secret so the route is hidden from probes.
- Disabled entirely when `SEED_SECRET` is not set.
- Every write is `upsert` → safe to re-run.
- Response: `{ ok: true, summary: { plans, stores, users, posts, ... } }`.

```bash
curl -X POST https://app/api/v1/admin/seed -H "X-Seed-Secret: <SEED_SECRET>"
```

> Rotate or unset `SEED_SECRET` once real production data exists.

---

## 9. Redis caching layer

Use `RedisService.wrap(key, ttl, fn)` for cache-aside. Build keys via `CacheKeys.*` so reads and invalidations stay in sync:

```ts
const ttl = this.config.get<number>('cacheTtl.user') ?? 300;
return this.redis.wrap(CacheKeys.user(user.userId), ttl, async () => {
  return this.prisma.user.findFirstOrThrow({ where: { id: user.userId } });
});

// On write/update/delete:
await this.redis.del(CacheKeys.user(userId));
await this.redis.delByPattern(CacheKeys.storeAll(storeId)); // SCAN-based, non-blocking
```

---

## 10. Worked example — `Posts` module

This is the **only example you need**. Copy it to add any new resource — rename `Post`/`posts` and add fields.

### `src/modules/posts/posts.module.ts`

```ts
import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
```

### `src/modules/posts/dto/create-post.dto.ts`

```ts
import { IsOptional, IsString, Length } from 'class-validator';

export class CreatePostDto {
  @IsString() @Length(1, 200)
  title!: string;

  @IsOptional() @IsString() @Length(0, 5000)
  body?: string;
}
```

### `src/modules/posts/dto/list-posts.dto.ts`

```ts
import { IsOptional, IsString, Length } from 'class-validator';
import { PaginationDto } from '../../../common/utils/pagination';

export class ListPostsDto extends PaginationDto {
  @IsOptional() @IsString() @Length(1, 80)
  search?: string;
}
```

### `src/modules/posts/posts.controller.ts`

```ts
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsDto } from './dto/list-posts.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types/auth-user';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @ApiOperation({ summary: 'List posts (paginated, searchable)' })
  list(@StoreId() storeId: string, @Query() q: ListPostsDto) {
    return this.posts.list(storeId, q);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Create a post in the active store' })
  create(@Body() dto: CreatePostDto, @CurrentUser() user: AuthUser) {
    return this.posts.create(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a post by id or publicId' })
  getOne(@StoreId() storeId: string, @Param('id') id: string) {
    return this.posts.getById(storeId, id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a post' })
  update(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreatePostDto>,
  ) {
    return this.posts.update(storeId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a post' })
  remove(@StoreId() storeId: string, @Param('id') id: string) {
    return this.posts.softDelete(storeId, id);
  }
}
```

### `src/modules/posts/posts.service.ts`

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { buildPage } from '../../common/utils/pagination';
import { generatePublicId } from '../../common/utils/public-id';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsDto } from './dto/list-posts.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, q: ListPostsDto) {
    const mode = Prisma.QueryMode.insensitive;
    const where: Prisma.PostWhereInput = {
      storeId,
      deletedAt: null,
      ...(q.search && {
        OR: [
          { title: { contains: q.search, mode } },
          { publicId: { contains: q.search, mode } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.take,
      }),
      this.prisma.post.count({ where }),
    ]);
    return buildPage(rows, total, q);
  }

  async getById(storeId: string, id: string) {
    // Accept either the cuid `id` or the 6-digit `publicId`.
    const row = await this.prisma.post.findFirst({
      where: { storeId, deletedAt: null, OR: [{ id }, { publicId: id }] },
    });
    if (!row) throw new NotFoundException('Post not found');
    return row;
  }

  async create(dto: CreatePostDto, user: AuthUser) {
    const row = await this.createWithRetry(dto, user);
    return { message: 'Post created', data: { postId: row.publicId, post: row } };
  }

  async update(storeId: string, id: string, dto: Partial<CreatePostDto>) {
    const existing = await this.getById(storeId, id);
    const updated = await this.prisma.post.update({
      where: { id: existing.id }, data: { ...dto },
    });
    return { message: 'Post updated', data: updated };
  }

  async softDelete(storeId: string, id: string) {
    const existing = await this.getById(storeId, id);
    await this.prisma.post.update({
      where: { id: existing.id }, data: { deletedAt: new Date() },
    });
    return { message: 'Post deleted', data: { id: existing.id } };
  }

  private async createWithRetry(
    dto: CreatePostDto, user: AuthUser, attempt = 0,
  ): Promise<any> {
    try {
      return await this.prisma.post.create({
        data: {
          publicId: generatePublicId(),
          storeId: user.storeId,
          title: dto.title,
          body: dto.body,
          createdBy: user.userId,
        },
      });
    } catch (err) {
      // Retry up to 3x on (storeId, publicId) collision.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' && attempt < 3
      ) {
        return this.createWithRetry(dto, user, attempt + 1);
      }
      throw err;
    }
  }
}
```

---

## 11. Conventions (apply to every new module)

| Concern | Convention |
|---|---|
| **Tenant isolation** | Every Prisma query filters by `storeId`; use `@StoreId()` to pull it from JWT. Never trust a client-supplied `storeId`. |
| **Soft delete** | Add `deletedAt: DateTime?` to the model; always filter `deletedAt: null` on reads. |
| **Public IDs** | 6-digit numeric, unique per `(storeId, publicId)`. Use `generatePublicId()` + retry on `P2002`. |
| **Lookups** | Accept **either** the `cuid` id or the `publicId` via `OR: [{ id }, { publicId: id }]`. |
| **Listing** | Extend `PaginationDto`. Return `buildPage(rows, total, q)`. Use `Prisma.$transaction([findMany, count])`. |
| **Search** | `contains` + `Prisma.QueryMode.insensitive`. |
| **Validation** | Every body/query uses a DTO with `class-validator`. No bare `@Body() body: any`. |
| **Auth** | All controllers protected by default (global `JwtAuthGuard`). Use `@Public()` to opt out. |
| **Roles** | Use `@Roles(UserRole.ADMIN, ...)` per handler; `RolesGuard` enforces. |
| **Errors** | Throw `NotFoundException`, `ConflictException`, `ForbiddenException`. The global filter formats them. |
| **Responses** | Return raw data, or `{ message, data, meta }` to set headline fields. The interceptor wraps the envelope. |
| **Caching** | Use `RedisService.wrap(CacheKeys.x(...), ttl, fn)`. Invalidate on writes via `del`/`delByPattern`. |
| **Logging** | `Logger` from `@nestjs/common`. Never log secrets, tokens, or password hashes. |
| **Imports** | Inside `src/`: relative imports (`../../common/...`). No path aliases used at runtime. |
| **Decorators order** | `@ApiOperation` first, then `@Roles`, then HTTP method. (Or HTTP method first — be consistent.) |

---

## 12. Add-a-new-module checklist

For every new resource (e.g. `orders`, `invoices`, `items`):

1. Add the model to `prisma/schema.prisma` with `storeId`, `publicId`, `createdAt/updatedAt/deletedAt`, `@@unique([storeId, publicId])`, `@@index([storeId, createdAt(sort: Desc)])`, `@@index([deletedAt])`.
2. `npx prisma migrate dev --name add_<resource>`.
3. Create `src/modules/<resource>/` containing `<resource>.module.ts`, `<resource>.controller.ts`, `<resource>.service.ts`, `dto/create-<resource>.dto.ts`, `dto/list-<resource>.dto.ts`.
4. Copy the **Posts example** (section 10) and rename. Adjust DTO fields and search columns.
5. Register the module in `app.module.ts`.
6. Add seed entries to `src/modules/admin/seed.service.ts` if there's canonical data.
7. If list responses are expensive, cache via `RedisService.wrap` and invalidate on writes.

---

## 13. Scripts (`package.json`)

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "test": "jest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "prisma:seed": "ts-node prisma/seed.ts"
  },
  "prisma": { "seed": "ts-node prisma/seed.ts" }
}
```

---

## 14. Deployment (Railway)

1. Provision **Postgres** + **Redis** plugins.
2. Set env vars from section 3 — at minimum `DATABASE_URL`, `REDIS_*`, `JWT_SECRET`, `SEED_SECRET`.
3. **Build command:** `npm ci && npx prisma generate && npm run build`.
4. **Release / migrate:** `npx prisma migrate deploy`.
5. **Start:** `npm run start:prod`.
6. After first deploy, call `POST /api/v1/admin/seed` with `X-Seed-Secret` to seed reference data.
7. Rotate / unset `SEED_SECRET` once real prod data exists.

---

## 15. Boot-up instruction (paste this on top in a new conversation)

> Build a NestJS backend following `PROJECT_BLUEPRINT.md` exactly:
> - Same folder structure (section 2)
> - Same `package.json` deps (section 1) and scripts (section 13)
> - Same `tsconfig`, `main.ts`, `app.module.ts` (section 4)
> - Same common building blocks: decorators, guards, filters, interceptors, types, utils (section 6)
> - Same `auth/` (section 7) and `admin/` (section 8) modules
> - Replace the `posts/` example with my actual first module: `<MY_MODULE>` with fields `<list fields>`
> - Use the conventions in section 11 and the add-a-new-module checklist in section 12 for every subsequent resource.
> Project name: `<name>`. DB schema name: `<schema>`. Confirm the structure before writing code.
