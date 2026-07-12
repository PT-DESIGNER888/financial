import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { FinanceService } from './finance.service';

class OpeningDto {
  @Type(() => Number) @IsNumber() @Min(0) openingCash: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) openingDate?: string;
}

class CashTxDto {
  @IsIn(['CAPITAL_IN', 'CAPITAL_OUT', 'INCOME', 'EXPENSE'])
  type: 'CAPITAL_IN' | 'CAPITAL_OUT' | 'INCOME' | 'EXPENSE';

  @Type(() => Number) @IsNumber() @IsPositive() amount: number;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;

  @IsOptional() @IsString() note?: string;
}

@Controller('finance')
export class FinanceController {
  constructor(private finance: FinanceService) {}

  @Get('cash')
  cash() {
    return this.finance.cashPosition();
  }

  @Get('opening')
  getOpening() {
    return this.finance.getOpening();
  }

  @Post('opening')
  setOpening(@Body() dto: OpeningDto) {
    return this.finance.setOpening(dto.openingCash, dto.openingDate);
  }

  @Get('cashtx')
  listCashTx() {
    return this.finance.listCashTx();
  }

  @Post('cashtx')
  addCashTx(@Body() dto: CashTxDto) {
    return this.finance.addCashTx(dto);
  }

  @Delete('cashtx/:id')
  @HttpCode(204)
  removeCashTx(@Param('id') id: string) {
    return this.finance.removeCashTx(id);
  }

  @Get('ledger')
  ledger(@Query('month') month?: string, @Query('limit') limit?: string) {
    return this.finance.ledger({
      month,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('monthly')
  monthly(@Query('month') month: string) {
    return this.finance.monthly(
      month ?? new Date().toISOString().slice(0, 7),
    );
  }

  @Get('trend')
  trend(@Query('days') days?: string) {
    return this.finance.dailyTrend(days ? parseInt(days, 10) : 30);
  }

  @Get('export.csv')
  async exportCsv(@Query('month') month: string, @Res() res: Response) {
    const csv = await this.finance.ledgerCsv(month || undefined);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ledger${month ? '-' + month : ''}.csv"`,
    );
    res.send(csv);
  }
}
