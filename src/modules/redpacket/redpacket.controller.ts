import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { AuthenticatedUser } from '../auth/types/request-with-user.type';
import { RedpacketService } from './redpacket.service';
import { RedpacketCreateDto } from './dto/redpacket-create.dto';
import { RedpacketListQueryDto } from './dto/redpacket-list-query.dto';
import { RedpacketClaimDto } from './dto/redpacket-claim.dto';

@Controller('api/redpacket')
@UseGuards(AuthGuard)
export class RedpacketController {
  constructor(@Inject(RedpacketService) private readonly redpacketService: RedpacketService) {}

  @Post('create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: RedpacketCreateDto) {
    return this.redpacketService.createPacket(user.userId, body);
  }

  @Get('user/packets')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: RedpacketListQueryDto) {
    return this.redpacketService.listPackets(user.userId, query.type);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.redpacketService.getPacket(user.userId, id);
  }

  @Post(':id/claim')
  claim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: RedpacketClaimDto,
  ) {
    return this.redpacketService.claimPacket(user.userId, id, body.address);
  }
}
