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
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { PaymentsService } from './payments.service';

class RecordPaymentDto {
  @IsString() @IsNotEmpty() loanId: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) paidDate?: string;

  @Type(() => Number) @IsNumber() @IsPositive() amount: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) arrearsPaid?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) interestPaid?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) principalPaid?: number;

  @IsOptional() @IsString() note?: string;
}

@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post()
  record(@Body() dto: RecordPaymentDto) {
    return this.payments.record(dto);
  }

  @Get('suggest')
  suggest(@Query('loanId') loanId: string, @Query('amount') amount: string) {
    return this.payments.suggestAllocation(loanId, parseFloat(amount));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.payments.remove(id);
  }
}
