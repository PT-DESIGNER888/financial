import { LoanStatus } from '../common/enums';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { todayStr } from '../common/date.util';
import { Loan } from '../entities/loan.entity';
import { Setting } from '../entities/setting.entity';
import { LoansService } from '../loans/loans.service';

const LINE_TOKEN = 'lineChannelToken';
const LINE_TARGET = 'lineTargetId';

function fmt(n: number): string {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

@Injectable()
export class NotifyService {
  constructor(
    @InjectRepository(Loan) private loans: Repository<Loan>,
    @InjectRepository(Setting) private settings: Repository<Setting>,
    private loansService: LoansService,
  ) {}

  private async get(key: string) {
    return (await this.settings.findOneBy({ key }))?.value ?? null;
  }

  async getConfig() {
    const token = await this.get(LINE_TOKEN);
    const target = await this.get(LINE_TARGET);
    return {
      configured: !!(token && target),
      hasToken: !!token,
      targetId: target,
    };
  }

  async setConfig(token: string, targetId: string) {
    await this.settings.save({ key: LINE_TOKEN, value: token });
    await this.settings.save({ key: LINE_TARGET, value: targetId });
    return this.getConfig();
  }

  /** ยอดที่ค้างนาน (มียอดค้าง) เรียงจากค้างมากสุด */
  async overdue() {
    await this.loansService.accrueAllActive();
    const loans = await this.loans.find({
      where: { status: LoanStatus.ACTIVE },
      relations: { debtor: true },
    });
    return loans
      .filter((l) => l.arrears > 0)
      .sort((a, b) => b.arrears - a.arrears)
      .map((l) => ({
        loanId: l.id,
        debtorId: l.debtorId,
        debtorName: l.debtor?.name ?? '',
        arrears: l.arrears,
        outstandingPrincipal: l.outstandingPrincipal,
      }));
  }

  /** ประกอบข้อความสรุปยอดต้องเก็บวันนี้ (ข้อความล้วนสำหรับส่ง LINE) */
  async composeDailySummary(): Promise<string> {
    await this.loansService.accrueAllActive();
    const today = todayStr();
    const loans = await this.loans.find({
      where: {
        status: In([
          LoanStatus.ACTIVE,
          LoanStatus.DEAD,
          LoanStatus.INSTALLMENT,
        ]),
      },
      relations: { debtor: true, cycles: true, payments: true },
    });

    const lines: string[] = [];
    let total = 0;
    let count = 0;
    for (const l of loans) {
      const frozen =
        l.status === LoanStatus.DEAD || l.status === LoanStatus.INSTALLMENT;
      const due = this.loansService.isDueOn(l, today);
      const appt = !frozen
        ? this.loansService.interestAppointmentQuote(l)
        : null;
      let interest = 0;
      if (l.status === LoanStatus.ACTIVE) {
        if (appt && l.interestDueDate === today) interest = appt.remaining;
        else if (appt && l.interestDueDate && today < l.interestDueDate && due)
          interest = 0;
        else if (due) interest = this.loansService.dueInterestOn(l, today);
      }
      let installment = 0;
      if (l.status === LoanStatus.DEAD && due) {
        installment = Math.min(l.installmentAmount ?? 0, l.deadBalance ?? 0);
      } else if (l.status === LoanStatus.INSTALLMENT) {
        installment =
          this.loansService.buildInstallmentSchedule(l, today)?.dueNow ?? 0;
      }
      const arrears = frozen ? 0 : l.arrears;
      const owe = interest + installment + arrears;
      if (owe <= 0) continue;
      count++;
      total += owe;
      const tag =
        l.status === LoanStatus.DEAD
          ? ' (ผ่อน)'
          : l.status === LoanStatus.INSTALLMENT
            ? ' (ผ่อนงวด)'
            : '';
      lines.push(`• ${l.debtor?.name ?? ''}${tag}: ฿${fmt(owe)}`);
    }

    const [y, m, d] = today.split('-');
    const header = `📋 สรุปเก็บวันนี้ ${d}/${m}/${y}`;
    if (count === 0) return `${header}\nวันนี้ไม่มียอดต้องเก็บ ✅`;
    return `${header}\nต้องเก็บ ${count} ราย รวม ฿${fmt(total)}\n\n${lines.join('\n')}`;
  }

  /** ส่งข้อความเข้า LINE (push). ถ้ายังไม่ตั้ง token → คืน notConfigured */
  async sendLine(
    message: string,
  ): Promise<{ sent: boolean; reason?: string; preview: string }> {
    const token = await this.get(LINE_TOKEN);
    const target = await this.get(LINE_TARGET);
    if (!token || !target)
      return {
        sent: false,
        reason: 'ยังไม่ได้ตั้งค่า LINE token/ผู้รับ',
        preview: message,
      };
    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: target,
          messages: [{ type: 'text', text: message }],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        return {
          sent: false,
          reason: `LINE ตอบกลับ ${res.status}: ${body}`,
          preview: message,
        };
      }
      return { sent: true, preview: message };
    } catch (e) {
      return {
        sent: false,
        reason: e instanceof Error ? e.message : 'ส่งไม่สำเร็จ',
        preview: message,
      };
    }
  }

  async sendDailySummary() {
    const msg = await this.composeDailySummary();
    return this.sendLine(msg);
  }
}
