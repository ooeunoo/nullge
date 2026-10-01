import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MarketingStore, checkAssetSignature } from '@nullge/database';
import {
  channelSchema,
  connectionInput,
  connectionRevision,
  generationInput,
  generationConfirm,
  integrationInput,
  bufferConnectionInput,
} from '@nullge/contracts';
import { SessionGuard, origin, type AuthenticatedRequest } from './auth';
function parse<T>(
  schema: {
    safeParse(v: unknown): { success: true; data: T } | { success: false };
  },
  v: unknown,
) {
  const r = schema.safeParse(v);
  if (!r.success) throw new BadRequestException('입력 형식과 길이를 확인해 주세요.');
  return r.data;
}
@Controller()
@UseGuards(SessionGuard)
export class MarketingController {
  constructor(@Inject('MARKETING') private readonly store: MarketingStore) {}
  @Get('settings/integrations') settings(@Req() r: AuthenticatedRequest) {
    return this.store.settings(r.operator.workspaceId);
  }
  @Patch('settings/integrations') save(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    return this.store.saveSettings(r.operator.workspaceId, r.operator.id, parse(integrationInput, body));
  }
  @Post('settings/integrations/verify') verify(@Req() r: AuthenticatedRequest) {
    return this.store.verifyOpenAI(r.operator.workspaceId);
  }
  @Get('settings/buffer/channels') bufferChannels(@Req() r: AuthenticatedRequest) {
    return this.store.bufferChannels(r.operator.workspaceId);
  }
  @Get('projects/:slug/channels') channels(@Req() r: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.store.connections(r.operator.workspaceId, slug);
  }
  @Post('projects/:slug/channels/:channel/connect') connect(
    @Req() r: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Param('channel') channel: string,
    @Body() body: unknown,
  ) {
    const input = parse(connectionInput, body);
    return this.store.connect(
      r.operator.workspaceId,
      slug,
      parse(channelSchema, channel),
      r.operator.id,
      input.revision,
      input.token,
    );
  }
  @Post('projects/:slug/channels/:channel/buffer') connectBuffer(
    @Req() r: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Param('channel') channel: string,
    @Body() body: unknown,
  ) {
    const input = parse(bufferConnectionInput, body);
    return this.store.connectBuffer(
      r.operator.workspaceId,
      slug,
      parse(channelSchema, channel),
      r.operator.id,
      input.revision,
      input.channelId,
    );
  }
  @Post('projects/:slug/channels/:channel/disconnect') disconnect(
    @Req() r: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Param('channel') channel: string,
    @Body() body: unknown,
  ) {
    return this.store.disconnect(
      r.operator.workspaceId,
      slug,
      parse(channelSchema, channel),
      r.operator.id,
      parse(connectionRevision, body).revision,
    );
  }
  @Post('projects/:slug/channels/:channel/verify') verifyChannel(
    @Req() r: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Param('channel') channel: string,
    @Body() body: unknown,
  ) {
    return this.store.verifyConnection(
      r.operator.workspaceId,
      slug,
      parse(channelSchema, channel),
      parse(connectionRevision, body).revision,
    );
  }
  @Post('projects/:slug/channels/:channel/authorize') authorize(
    @Req() r: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Param('channel') channel: string,
    @Body() body: unknown,
  ) {
    return this.store.beginOAuth(
      r.operator.workspaceId,
      slug,
      parse(channelSchema, channel),
      r.operator.id,
      parse(connectionRevision, body).revision,
      origin(),
    );
  }
  @Get('channels/:channel/callback') async callback(
    @Req() r: AuthenticatedRequest,
    @Param('channel') channel: string,
    @Res() response: Response,
  ) {
    const provider = parse(channelSchema, channel);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const result = await this.store.completeOAuth(
        r.operator.workspaceId,
        r.operator.id,
        provider,
        typeof r.query.state === 'string' ? r.query.state : '',
        typeof r.query.code === 'string' ? r.query.code : '',
        r.query.error !== undefined || r.query.error_reason !== undefined,
      );
      response.redirect(
        `${origin()}/projects/${result.slug}/channels?${result.connected ? 'connected' : 'connection_error'}=${provider}`,
      );
    } catch {
      response.redirect(`${origin()}/settings?connection_error=${provider}`);
    }
  }
  @Post('projects/:slug/generations/quote') quote(
    @Req() r: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() body: unknown,
  ) {
    return this.store.quote(r.operator.workspaceId, slug, r.operator.id, parse(generationInput, body));
  }
  @Post('projects/:slug/generations/confirm') confirm(
    @Req() r: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() body: unknown,
  ) {
    const input = parse(generationConfirm, body);
    return this.store.confirm(r.operator.workspaceId, slug, r.operator.id, input.quoteId);
  }
  @Get('projects/:slug/generations') jobs(@Req() r: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.store.jobs(r.operator.workspaceId, slug);
  }
  @Get('assets/:id') async asset(
    @Req() r: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() response: Response,
  ) {
    const width = [240, 480, 720, 1080].includes(Number(r.query.w)) ? Number(r.query.w) : undefined;
    const file = await this.store.asset(r.operator.workspaceId, id, width);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Content-Length', file.content.length);
    // Asset ids are immutable, so the browser may keep them; still private to the operator session.
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    response.send(file.content);
  }
}
@Controller('public-assets')
export class PublicAssetController {
  constructor(@Inject('MARKETING') private readonly store: MarketingStore) {}
  @Get(':id') async asset(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() response: Response,
  ) {
    const w = String(r.query.workspace || '');
    checkAssetSignature(w, id, String(r.query.expires || ''), String(r.query.signature || ''));
    const file = await this.store.asset(w, id);
    const size = file.content.length;
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Accept-Ranges', 'bytes');
    // Video fetchers read in byte ranges; answer a single range and fall back to the whole file otherwise.
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(r.headers.range || ''));
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start > end || start >= size) {
        response.status(416).setHeader('Content-Range', `bytes */${size}`);
        response.end();
        return;
      }
      response.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      response.setHeader('Content-Length', end - start + 1);
      response.end(file.content.subarray(start, end + 1));
      return;
    }
    response.setHeader('Content-Length', size);
    response.send(file.content);
  }
}
