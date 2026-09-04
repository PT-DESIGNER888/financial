import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
import {
  InterestMode,
  LoanCycle,
  LoanKind,
  REVOLVING_CYCLES,
} from '../common/enums';
import type { RevolvingCycle } from '../common/enums';
import { LoansService } from './loans.service';

const CYCLES = Object.values(LoanCycle);
type Cycle = LoanCycle;

class CreateLoanDto {
  @IsString() @IsNotEmpty() debtorId: string;

  /** REVOLVING = ดอกลอย/คงที่ (ค่าเริ่มต้น), INSTALLMENT = ผ่อนเป็นงวด,
   *  DEAD = ยอดตายคีย์มือ (ตรึงยอดที่กรอก ไม่คิดดอก) */
  @IsOptional()
  @IsIn(Object.values(LoanKind))
  type?: LoanKind;

  @Type(() => Number) @IsNumber() @IsPositive() principalOriginal: number;

  /** ยอดเก่าที่เดินอยู่แล้ว: ต้นคงเหลือ ณ วันขึ้นระบบ */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  outstandingPrincipal?: number;

  /** ยอดเก่าที่เดินอยู่แล้ว: ดอกค้าง ณ วันขึ้นระบบ */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  arrears?: number;

  /** อัตราดอก — ดอกลอย/คงที่: %/รอบ, ลดต้นลดดอก: %/งวดจากต้นคงเหลือ
   *  (ยอดตายคีย์มือไม่ต้องกรอก — ไม่คิดดอก) */
  @ValidateIf(
    (o: CreateLoanDto) =>
      o.type !== LoanKind.DEAD &&
      (o.type !== LoanKind.INSTALLMENT || o.amortized === true),
  )
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  interestRatePercent?: number;

  /** ยอดตายคีย์มือ: งวดที่ตกลงผ่อน (ไม่กรอก = ทยอยคืนเมื่อไหร่ก็ได้) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  installmentAmount?: number;

  @ValidateIf((o: CreateLoanDto) => o.type !== LoanKind.DEAD)
  @IsIn(CYCLES)
  cycle: Cycle;

  @IsOptional()
  @IsIn(Object.values(InterestMode))
  interestMode?: InterestMode;

  /** ผ่อนเป็นงวด: จำนวนงวด */
  @ValidateIf((o: CreateLoanDto) => o.type === 'INSTALLMENT')
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  installmentCount?: number;

  /** ผ่อนดอกคงที่: ดอกรวมทั้งสัญญา (บาท, 0 ได้) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalInterest?: number;

  /** ผ่อนดอกคงที่ (รูปแบบเดิม): ยอดผ่อนรวม (ต้น + ดอกรวม) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  interestRatePercent?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) fee?: number;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) firstDueDate?: string;

  @IsOptional() @IsBoolean() roundInstallments?: boolean;
}

class ConvertDeadDto {
  /** ไม่ส่ง = ทยอยคืนเมื่อไหร่ก็ได้ ไม่มีกำหนดตายตัว */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  installmentAmount?: number;
}

class EditLoanDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  interestRatePercent?: number;

  @IsOptional()
  @IsIn(REVOLVING_CYCLES)
  cycle?: RevolvingCycle;

  /** ยอดตาย: งวดผ่อน/10 วัน (ล้างงวดใช้ clearInstallment) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  installmentAmount?: number;

  /** true = ยอดตายนี้ไม่มีกำหนดงวดตายตัว ทยอยคืนเมื่อไหร่ก็ได้ */
  @IsOptional() @IsBoolean() clearInstallment?: boolean;

  /** ยอดผ่อนงวด: แก้แผนผ่อนของยอดที่เปิดไปแล้ว */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  installmentCount?: number;

  /** ยอดผ่อนงวด: ผ่อนรวมใหม่ (ต้น + ดอก + ค่าธรรมเนียม) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  installmentTotal?: number;

  /** ยอดผ่อนงวด: ปัดยอดต่องวดเป็นบาทเต็ม เศษไปงวดสุดท้าย */
  @IsOptional() @IsBoolean() roundInstallments?: boolean;

  /** นัดคืนต้น: วันที่ตกลงจะเอาเงินก้อนมาตัดต้น (ล้างนัดใช้ clearPrincipalDue) */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) principalDueDate?: string;

  /** นัดคืนต้น: ยอดที่ตกลงจะคืน */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  principalDueAmount?: number;

  /** true = ล้างนัดคืนต้นทิ้ง */
  @IsOptional() @IsBoolean() clearPrincipalDue?: boolean;

  /** นัดชำระดอก: วันที่ตกลงจะมาจ่ายดอกเป็นก้อน (ล้างนัดใช้ clearInterestDue) */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) interestDueDate?: string;

  /** นัดชำระดอก: ยอดที่ตกลงเก็บทั้งก้อน — ไม่ส่ง = ใช้ผลรวมที่ระบบคำนวณ */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  interestDueAmount?: number;

  /** true = ล้างนัดชำระดอกทิ้ง */
  @IsOptional() @IsBoolean() clearInterestDue?: boolean;

  @IsOptional() @IsString() note?: string;
}

/** แก้รอบดอกรายรอบ: เลื่อนวันครบกำหนด / ตกลงเก็บดอกจริง */
class EditCycleDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  interestOverride?: number;

  /** true = ล้าง override กลับไปใช้ดอกที่ระบบคำนวณ */
  @IsOptional() @IsBoolean() clearOverride?: boolean;
}

class AdjustLoanDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  outstandingPrincipal?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) arrears?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) deadBalance?: number;

  /** ยอดหนี้สูญ (สถานะ BAD_DEBT) — แก้ยอดขาดทุนตรงๆ */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) badDebtLoss?: number;

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

  /** รอบดอกของยอดดอกลอย/คงที่ (รอบล่าสุด + รอบที่กำลังเดิน/อนาคต) */
  @Get(':id/cycles')
  cycles(@Param('id') id: string, @Query('until') until?: string) {
    return this.loans.getCycles(id, until);
  }

  @Patch(':id/cycles/:cycleId')
  editCycle(
    @Param('id') id: string,
    @Param('cycleId') cycleId: string,
    @Body() dto: EditCycleDto,
  ) {
    return this.loans.updateCycle(id, cycleId, {
      dueDate: dto.dueDate,
      interestOverride: dto.clearOverride ? null : dto.interestOverride,
    });
  }

  @Post(':id/dead')
  convertToDead(@Param('id') id: string, @Body() dto: ConvertDeadDto) {
    return this.loans.convertToDead(id, dto.installmentAmount);
  }

  /** พรีวิวรียอด: ยอดเหลือเดิม + เงินสดที่ต้องจ่ายเพิ่มเมื่อต้นใหม่ = newPrincipal */
  @Get(':id/refinance-quote')
  refinanceQuote(
    @Param('id') id: string,
    @Query('newPrincipal') newPrincipal?: string,
  ) {
    return this.loans.refinanceQuote(id, parseFloat(newPrincipal ?? '0') || 0);
  }

  /** รียอด: ปิดสัญญาเดิม เปิดสัญญาใหม่ (debtorId ยึดจากสัญญาเดิม) */
  @Post(':id/refinance')
  refinance(@Param('id') id: string, @Body() dto: CreateLoanDto) {
    return this.loans.refinance(id, dto);
  }

  @Patch(':id')
  edit(@Param('id') id: string, @Body() dto: EditLoanDto) {
    const { clearPrincipalDue, clearInterestDue, clearInstallment, ...rest } =
      dto;
    return this.loans.editTerms(id, {
      ...rest,
      installmentAmount: clearInstallment ? null : dto.installmentAmount,
      principalDueDate: clearPrincipalDue ? null : dto.principalDueDate,
      principalDueAmount: clearPrincipalDue ? null : dto.principalDueAmount,
      interestDueDate: clearInterestDue ? null : dto.interestDueDate,
      interestDueAmount: clearInterestDue ? null : dto.interestDueAmount,
    });
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
  reopen(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.loans.reopen(id, dto.reason);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.loans.remove(id);
  }
}
