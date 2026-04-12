import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { UtxoService } from './utxo.service';
import { UtxoSelectDto } from './dto/utxo-select.dto';

@Controller('api/utxo')
@UseGuards(AuthGuard)
export class UtxoController {
  constructor(@Inject(UtxoService) private readonly utxoService: UtxoService) {}

  @Get('select')
  select(@Query() query: UtxoSelectDto): Promise<{ utxos: any[]; totalAmount: string }> {
    return this.utxoService.selectUtxos(query.address, query.amount, query.feeRate);
  }
}
