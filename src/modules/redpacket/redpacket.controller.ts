import { Body, Controller, Get, HttpStatus, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { AuthenticatedUser } from '../auth/types/request-with-user.type';
import { AuthService } from '../auth/auth.service';
import { AppException } from '../../common/exceptions/app.exception';
import { RedpacketService } from './redpacket.service';
import { RedpacketCreateDto } from './dto/redpacket-create.dto';
import { RedpacketListQueryDto } from './dto/redpacket-list-query.dto';
import { RedpacketClaimDto } from './dto/redpacket-claim.dto';
import { RedpacketDapOutputsDto } from './dto/redpacket-dap-outputs.dto';
import { buildDapOutputs } from './redpacket-dap.util';

@Controller('api/redpacket')
@UseGuards(AuthGuard)
export class RedpacketController {
  constructor(
    @Inject(RedpacketService) private readonly redpacketService: RedpacketService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  /** In-memory rate limiter: userId + packetHash → { count, resetAt } */
  private readonly rateLimitMap = new Map<string, { count: number; resetAt: number }>()
  private rateCheckCount = 0

  /**
   * Per-user per-packet rate limit.
   * Default: 3 attempts per 60 seconds.
   */
  private checkClaimRateLimit(userId: number, packetHash: string, maxAttempts = 3, windowMs = 60_000): void {
    const key = `claim:${userId}:${packetHash}`
    const now = Date.now()
    const entry = this.rateLimitMap.get(key)

    if (!entry || now > entry.resetAt) {
      this.rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    } else if (entry.count >= maxAttempts) {
      throw new AppException('领取过于频繁，请稍后再试', 'RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS)
    } else {
      entry.count++
    }

    // Periodically sweep expired entries to prevent memory leak
    this.rateCheckCount++
    if (this.rateCheckCount % 100 === 0) {
      this.sweepExpiredRateLimits()
    }
  }

  private sweepExpiredRateLimits(): void {
    const now = Date.now()
    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetAt) {
        this.rateLimitMap.delete(key)
      }
    }
  }

  @Post('dap/outputs')
  dapOutputs(@Body() body: RedpacketDapOutputsDto) {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    return buildDapOutputs(nodeEnv, body.message);
  }

  @Post('create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: RedpacketCreateDto) {
    return this.redpacketService.createPacket(user.userId, body);
  }

  @Get('user/packets')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: RedpacketListQueryDto) {
    return this.redpacketService.listPackets(user.userId, query.type);
  }

  @Get('leaderboard')
  leaderboard() {
    return this.redpacketService.getLeaderboard(20);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.redpacketService.getPacket(user.userId, id);
  }

  @Post(':id/claim')
  async claim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: RedpacketClaimDto,
  ) {
    // 1. Rate limit per user per packet
    this.checkClaimRateLimit(user.userId, id)

    // 2. Verify fresh initData to ensure the claim originates from
    // an active Telegram Mini App session, not a replayed API call.
    await this.authService.verifyInitData(body.initData, 60)

    return this.redpacketService.claimPacket(user.userId, id, body.address)
  }
}
