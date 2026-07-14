import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { LoansService } from './loans.service';

const CYCLES = ['DAILY', 'WEEKLY', 'TEN_DAY', 'MONTHLY'] as const;
type Cycle = (typeof CYCLES)[number];

class CreateLoanDto {
  @IsString() @IsNotEmpty() debtorId: string;

  /** REVOLVING = ดอกลอย/คงที่ (ค่าเริ่มต้น), INSTALLMENT = ผ่อนเป็นงวด */
  @IsOptional() @IsIn(['REVOLVING', 'INSTALLMENT'])
  type?: 'REVOLVING' | 'INSTALLMENT';

  @Type(() => Number) @IsNumber() @IsPositive() principalOriginal: number;

  /** ยอดเก่าที่เดินอยู่แล้ว: ต้นคงเหลือ ณ วันขึ้นระบบ */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  outstandingPrincipal?: number;

  /** ยอดเก่าที่เดินอยู่แล้ว: ดอกค้าง ณ วันขึ้นระบบ */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  arrears?: number;

  /** อัตราดอก — ดอกลอย/คงที่: %/รอบ, ลดต้นลดดอก: %/งวดจากต้นคงเหลือ */
  @ValidateIf((o) => o.type !== 'INSTALLMENT' || o.amortized === true)
  @Type(() => Number) @IsNumber() @IsPositive() interestRatePercent?: number;

  @IsIn(CYCLES) cycle: Cycle;

  @IsOptional() @IsIn(['FLOATING', 'FLAT'])
  interestMode?: 'FLOATING' | 'FLAT';

  /** ผ่อนเป็นงวด: จำนวนงวด */
  @ValidateIf((o) => o.type === 'INSTALLMENT')
  @Type(() => Number) @IsInt() @IsPositive() installmentCount?: number;

  /** ผ่อนดอกคงที่: ดอกรวมทั้งสัญญา (บาท, 0 ได้) */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  totalInterest?: number;

  /** ผ่อนดอกคงที่ (รูปแบบเดิม): ยอดผ่อนรวม (ต้น + ดอกรวม) */
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive()
  installmentTotal?: number;

  /** ผ่อนเป็นงวด: true = ลดต้นลดดอก */
  @IsOptional() @IsBoolean() amortized?: boolean;

  /** ค่าธรรมเนียมเพิ่มเติม รวมเข้ายอดชำระ */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) fee?: number;

  /** วันครบกำหนดงวดแรก (เลือกเอง) */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) firstDueDate?: string;

  /** ปัดยอดต่องวดเป็นบาทเต็ม เศษไปงวดสุดท้าย */
  @IsOptional() @IsBoolean() roundInstallments?: boolean;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;

  @IsOptional() @IsString() note?: string;
}

/** พรีวิวแผนผ่อน — ฟิลด์เดียวกับตอนสร้าง แต่ไม่ต้องมีลูกหนี้ */
class PreviewLoanDto {
  @Type(() => Number) @IsNumber() @IsPositive() principalOriginal: number;

  @Type(() => Number) @IsInt() @IsPositive() installmentCount: number;

  @IsIn(CYCLES) cycle: Cycle;

  @IsOptional() @IsBoolean() amortized?: boolean;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) totalInterest?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive()
  interestRatePercent?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) fee?: number;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) firstDueDate?: string;

  @IsOptional() @IsBoolean() roundInstallments?: boolean;
}

class ConvertDeadDto {
  @Type(() => Number) @IsNumber() @IsPositive() installmentAmount: number;
}

class EditLoanDto {
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive()
  interestRatePercent?: number;

  @IsOptional() @IsIn(['DAILY', 'TEN_DAY']) cycle?: 'DAILY' | 'TEN_DAY';

  @IsOptional() @IsString() note?: string;
}

class AdjustLoanDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  outstandingPrincipal?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) arrears?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) deadBalance?: number;

  @IsString() @IsNotEmpty() reason: string;
}

class ReasonDto {
  @IsOptional() @IsString() reason?: string;
}

@Controller('loans')
export class LoansController {
  constructor(private loans: LoansService) {}

  @Post()
  create(@Body() dto: CreateLoanDto) {
    return this.loans.create(dto);
  }

  /** รายการสัญญาทั้งหมด พร้อมยอดสรุป (หน้า "สัญญาเงินกู้") */
  @Get()
  findAll() {
    return this.loans.findAll();
  }

  /** พรีวิวตารางงวด + ยอดสรุป ก่อนกดเปิดยอดจริง */
  @Post('preview')
  preview(@Body() dto: PreviewLoanDto) {
    return this.loans.preview(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loans.findOne(id);
  }

  @Get(':id/schedule')
  schedule(@Param('id') id: string) {
    return this.loans.getSchedule(id);
  }

  @Post(':id/dead')
  convertToDead(@Param('id') id: string, @Body() dto: ConvertDeadDto) {
    return this.loans.convertToDead(id, dto.installmentAmount);
  }

  @Patch(':id')
  edit(@Param('id') id: string, @Body() dto: EditLoanDto) {
    return this.loans.editTerms(id, dto);
  }

  @Post(':id/adjust')
  adjust(@Param('id') id: string, @Body() dto: AdjustLoanDto) {
    return this.loans.adjust(id, dto);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.loans.close(id, dto.reason);
  }

  @Post(':id/write-off')
  writeOff(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.loans.writeOff(id, dto.reason);
  }

  @Post(':id/reopen')
  reopen(@Param('id') id: string) {
    return this.loans.reopen(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.loans.remove(id);
  }
}
