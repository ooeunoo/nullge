import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import { json, type Request, type Response } from 'express';
import { database, Store, StoreError, MarketingStore, MarketingPublisher } from '@nullge/database';
import { MarketingController, PublicAssetController } from './marketing';
import {
  postInput,
  postUpdate,
  profileInput,
  revisionInput,
  publishConfirm,
  scheduleInput,
  externalPublication,
  POST_BODY_LIMIT,
} from '@nullge/contracts';
import { AuthService, SessionGuard, origin, localMode, type AuthenticatedRequest } from './auth';

function parse<T>(
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } },
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException('입력값의 길이와 형식을 확인해 주세요.');
  return result.data;
}
@Controller('auth')
class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get('options') options() {
    return this.auth.options();
  }
  @Post('local') local(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.local(request, response);
  }
  @Post('logout') logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.logout(request, response);
  }
  @Get('google') google(@Res() response: Response) {
    return this.auth.google(response);
  }
  @Get('google/callback') callback(@Req() request: Request, @Res() response: Response) {
    return this.auth.callback(request, response);
  }
}
@Controller()
@UseGuards(SessionGuard)
class ConsoleController {
  constructor(
    @Inject('STORE') private readonly store: Store,
    @Inject('PUBLISHER') private readonly publisher: MarketingPublisher,
  ) {}
  @Get('dashboard') async dashboard(@Req() request: AuthenticatedRequest) {
    return {
      ...(await this.store.dashboard(request.operator.workspaceId)),
      mode: localMode() ? 'local' : 'production',
      user: { name: request.operator.name, email: request.operator.email },
    };
  }
  @Post('projects/:slug/posts') create(
    @Req() r: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() body: unknown,
  ) {
    return this.store.create(r.operator.workspaceId, slug, r.operator.id, parse(postInput, body));
  }
  @Patch('projects/:slug/posts/:id') update(
    @Req() r: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.store.update(r.operator.workspaceId, slug, id, r.operator.id, parse(postUpdate, body));
  }
  @Post('projects/:slug/posts/:id/:action') transition(
    @Req() r: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('action') action: string,
    @Body() body: unknown,
  ) {
    if (action === 'schedule') {
      const input = parse(scheduleInput, body);
      return this.publisher.schedule(
        r.operator.workspaceId,
        slug,
        id,
        r.operator.id,
        input.revision,
        input.connectionRevision,
        input.scheduledAt,
      );
    }
    if (action === 'unschedule')
      return this.publisher.unschedule(
        r.operator.workspaceId,
        slug,
        id,
        r.operator.id,
        parse(revisionInput, body).revision,
      );
    if (action === 'publish') {
      const input = parse(publishConfirm, body);
      return this.publisher.enqueue(
        r.operator.workspaceId,
        slug,
        id,
        r.operator.id,
        input.revision,
        input.connectionRevision,
      );
    }
    if (action === 'delete')
      return this.store.remove(
        r.operator.workspaceId,
        slug,
        id,
        r.operator.id,
        parse(revisionInput, body).revision,
      );
    if (action === 'published') {
      const input = parse(externalPublication, body);
      return this.store.recordPublication(
        r.operator.workspaceId,
        slug,
        id,
        r.operator.id,
        input.revision,
        input.url,
      );
    }
    if (action !== 'approve' && action !== 'reopen')
      throw new BadRequestException('지원하지 않는 작업입니다.');
    return this.store.transition(
      r.operator.workspaceId,
      slug,
      id,
      r.operator.id,
      parse(revisionInput, body).revision,
      action,
    );
  }
  @Patch('projects/:slug/profile') profile(
    @Req() r: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() body: unknown,
  ) {
    return this.store.updateProfile(r.operator.workspaceId, slug, r.operator.id, parse(profileInput, body));
  }
  @Post('projects/:slug/profile/review') reviewProfile(
    @Req() r: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() body: unknown,
  ) {
    return this.store.reviewProfile(
      r.operator.workspaceId,
      slug,
      r.operator.id,
      parse(revisionInput, body).revision,
    );
  }
}
@Controller('health')
class HealthController {
  constructor(@Inject('DB') private readonly db: ReturnType<typeof database>) {}
  @Get() async health() {
    await this.db.query('SELECT 1');
    return { status: 'ok', publishing: false };
  }
}
async function run() {
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.CONSOLE_ORIGIN?.startsWith('https://') || process.env.CONSOLE_DEV_LOGIN === '1')
  )
    throw new Error('Production requires HTTPS origin; local login must be disabled.');
  const db = await database().initialize();
  @Module({
    controllers: [
      AuthController,
      ConsoleController,
      HealthController,
      MarketingController,
      PublicAssetController,
    ],
    providers: [
      { provide: 'DB', useValue: db },
      { provide: 'STORE', useValue: new Store(db) },
      { provide: 'MARKETING', useValue: new MarketingStore(db) },
      { provide: 'PUBLISHER', useValue: new MarketingPublisher(db) },
      AuthService,
      SessionGuard,
    ],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'], bodyParser: false });
  app.use((req: Request, res: Response, next: () => void) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin())
      return res.status(403).json({ message: '요청 출처를 확인할 수 없습니다.' });
    next();
  });
  const normalJson = json({ limit: '3mb' }),
    postJson = json({ limit: POST_BODY_LIMIT });
  app.use((req: Request, res: Response, next: () => void) => {
    const uploading =
      (req.method === 'POST' && /^\/projects\/[a-z0-9-]+\/posts$/.test(req.path)) ||
      (req.method === 'PATCH' && /^\/projects\/[a-z0-9-]+\/posts\/[a-f0-9-]{36}$/.test(req.path));
    return (uploading ? postJson : normalJson)(req, res, next);
  });
  app.useGlobalFilters({
    catch(error: unknown, host) {
      const response = host.switchToHttp().getResponse<Response>();
      const status =
        error instanceof StoreError ? error.status : error instanceof HttpException ? error.getStatus() : 500;
      response.status(status).json({
        message:
          error instanceof StoreError || error instanceof HttpException
            ? error.message
            : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
    },
  });
  await app.listen(
    Number(process.env.PORT || process.env.API_PORT || 4311),
    process.env.API_HOST || '127.0.0.1',
  );
  console.log('Nullge API ready.');
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    await app.close();
    await db.destroy();
  }
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}
run().catch(() => {
  console.error('API startup failed. Check database migration and environment configuration.');
  process.exitCode = 1;
});
