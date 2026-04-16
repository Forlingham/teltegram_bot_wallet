import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { CoverCreateDto } from './dto/cover-create.dto';
import { CoverPurchaseDto } from './dto/cover-purchase.dto';

@Injectable()
export class CoverService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createCover(payload: CoverCreateDto): Promise<{ coverId: number }> {
    const created = await this.prisma.cover.create({
      data: {
        name: payload.name,
        imageUrl: payload.imageUrl,
        botPath: payload.botPath,
        textTone: payload.textTone ?? 'LIGHT',
        price: payload.price,
        quantity: payload.quantity,
      },
    });

    return { coverId: created.id };
  }

  async listActiveCovers() {
    return this.prisma.cover.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async purchaseCover(userId: number, payload: CoverPurchaseDto): Promise<{ purchased: boolean }> {
    return this.prisma.$transaction(async (trx) => {
      const cover = await trx.cover.findUnique({ where: { id: payload.coverId } });
      if (!cover || !cover.isActive) {
        throw new AppException('Cover not available', 'COVER_NOT_AVAILABLE', HttpStatus.NOT_FOUND);
      }

      if (cover.sold >= cover.quantity) {
        throw new AppException('Cover sold out', 'COVER_SOLD_OUT', HttpStatus.BAD_REQUEST);
      }

      const exists = await trx.userCover.findFirst({
        where: {
          userId,
          coverId: cover.id,
        },
      });

      if (exists) {
        throw new AppException('Cover already owned', 'COVER_ALREADY_OWNED', HttpStatus.BAD_REQUEST);
      }

      await trx.userCover.create({
        data: {
          userId,
          coverId: cover.id,
        },
      });

      await trx.cover.update({
        where: { id: cover.id },
        data: {
          sold: {
            increment: 1,
          },
        },
      });

      return { purchased: true };
    });
  }

  async myCovers(userId: number) {
    const rows = await this.prisma.userCover.findMany({
      where: { userId },
      include: { cover: true },
      orderBy: { purchasedAt: 'desc' },
    });

    return rows.map((item) => item.cover);
  }
}
