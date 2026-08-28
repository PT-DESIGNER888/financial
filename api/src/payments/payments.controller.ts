import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { PaymentType } from '../common/enums';
import { PaymentsService } from './payments.service';

const PAYMENT_TYPES = Object.values(PaymentType);
type PaymentTypeDto = PaymentType;

class RecordPaymentDto {
  @IsString() @IsNotEmpty() loanId: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) paidDate?: string;

  @Type(() => Number) @IsNumber() @IsPositive() amount: number;

  /** ชำระดอก / ลดเงินต้น / ดอก+ลดต้น */
  @IsOptional() @IsIn(PAYMENT_TYPES) paymentType?: PaymentTypeDto;

  /** ยอดดอกรอบนี้ที่ตกลงเก็บจริง (override ที่ระบบคำนวณ) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  interestDueOverride?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) arrearsPaid?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) interestPaid?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) principalPaid?: number;

  @IsOptional() @IsString() note?: string;
}

class PrepayDto {
  @IsString() @IsNotEmpty() loanId: string;

  /** จำนวนรอบดอกที่จะชำระล่วงหน้า (รวมรอบที่กำลังเดิน) */
  @Type(() => Number) @IsInt() @IsPositive() count: number;
}

@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post()
  record(@Body() dto: RecordPaymentDto) {
    return this.payments.record(dto);
  }

  @Get('suggest')
  suggest(
    @Query('loanId') loanId: string,
    @Query('amount') amount: string,
    @Query('type') type?: string,
    @Query('interestDue') interestDue?: string,
  ) {
    const paymentType = PAYMENT_TYPES.includes(type as PaymentTypeDto)
      ? (type as PaymentTypeDto)
      : PaymentType.BOTH;
    const override =
      interestDue !== undefined && interestDue !== ''
        ? parseFloat(interestDue)
        : undefined;
    return this.payments.suggestAllocation(
      loanId,
      parseFloat(amount),
      paymentType,
      Number.isFinite(override) ? override : undefined,
    );
  }

  /** พรีวิวชำระดอกล่วงหน้า N รอบ */
  @Get('prepay-quote')
  prepayQuote(@Query('loanId') loanId: string, @Query('count') count?: string) {
    return this.payments.prepayQuote(loanId, parseInt(count ?? '1', 10) || 1);
  }

  /** ชำระดอกล่วงหน้า N รอบในครั้งเดียว */
  @Post('prepay')
  prepay(@Body() dto: PrepayDto) {
    return this.payments.prepayCycles(dto.loanId, dto.count);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.payments.remove(id);
  }
}
