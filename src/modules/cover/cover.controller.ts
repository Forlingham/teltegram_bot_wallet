import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { CoverService } from './cover.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { AuthenticatedUser } from '../auth/types/request-with-user.type';
import { CoverCreateDto } from './dto/cover-create.dto';
import { CoverPurchaseDto } from './dto/cover-purchase.dto';

@Controller('api/cover')
@UseGuards(AuthGuard)
export class CoverController {
  constructor(@Inject(CoverService) private readonly coverService: CoverService) {}

  @Post('create')
  create(@Body() body: CoverCreateDto): Promise<{ coverId: number }> {
    return this.coverService.createCover(body);
  }

  @Get('list')
  list() {
    return this.coverService.listActiveCovers();
  }

  @Post('purchase')
  purchase(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CoverPurchaseDto,
  ): Promise<{ purchased: boolean }> {
    return this.coverService.purchaseCover(user.userId, body);
  }

  @Get('my')
  my(@CurrentUser() user: AuthenticatedUser) {
    return this.coverService.myCovers(user.userId);
  }
}
