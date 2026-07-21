import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asDate(date?: string): string | undefined {
  if (date === undefined || date === '') return undefined;
  if (!DATE_RE.test(date))
    throw new BadRequestException('รูปแบบวันที่ไม่ถูกต้อง');
  return date;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  /** รายการเก็บของวันที่เลือก (ไม่ส่ง date = วันนี้) จัดกลุ่มตามลูกหนี้ */
  @Get('today')
  today(@Query('date') date?: string) {
    return this.dashboard.today(asDate(date));
  }

  /** ยอดค้าง + ยอดตาย แยกจากหน้าเก็บวันนี้ */
  @Get('arrears')
  arrears() {
    return this.dashboard.arrears();
  }

  /** บิลของลูกหนี้ในวันที่เลือก — สำหรับแคปส่งให้ลูกหนี้ */
  @Get('bill/:debtorId')
  bill(@Param('debtorId') debtorId: string, @Query('date') date?: string) {
    return this.dashboard.bill(debtorId, asDate(date));
  }

  @Get('summary')
  summary() {
    return this.dashboard.summary();
  }
}
