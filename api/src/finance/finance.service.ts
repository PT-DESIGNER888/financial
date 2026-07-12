import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashTx, CashTxType } from '../entities/cash-tx.entity';
import { Loan } from '../entities/loan.entity';
import { Payment } from '../entities/payment.entity';
import { Setting } from '../entities/setting.entity';

const OPENING_CASH = 'openingCash';
const OPENING_DATE = 'openingDate';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface LedgerEntry {
  date: string;
  kind: string; // ประเภทอ่านง่าย
  detail: string;
  cashIn: number; // เงินเข้า
  cashOut: number; // เงินออก
}

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(CashTx) private cashtx: Repository<CashTx>,
    @InjectRepository(Setting) private settings: Repository<Setting>,
    @InjectRepository(Loan) private loans: Repository<Loan>,
    @InjectRepository(Payment) private payments: Repository<Payment>,
  ) {}

  private async getSetting(key: string): Promise<string | null> {
    const s = await this.settings.findOneBy({ key });
    return s?.value ?? null;
  }

  async getOpening() {
    const cash = await this.getSetting(OPENING_CASH);
    const date = await this.getSetting(OPENING_DATE);
    return {
      openingCash: cash ? parseFloat(cash) : 0,
      openingDate: date,
    };
  }

  async setOpening(openingCash: number, openingDate?: string) {
    await this.settings.save({ key: OPENING_CASH, value: String(openingCash) });
    if (openingDate)
      await this.settings.save({ key: OPENING_DATE, value: openingDate });
    return this.getOpening();
  }

  // ---- รายรับรายจ่าย / เงินทุน (บันทึกเอง) ----
  listCashTx() {
    return this.cashtx.find({ order: { date: 'DESC', createdAt: 'DESC' } });
  }

  addCashTx(input: {
    type: CashTxType;
    amount: number;
    date?: string;
    note?: string;
  }) {
    return this.cashtx.save(
      this.cashtx.create({
        type: input.type,
        amount: input.amount,
        date: input.date ?? new Date().toISOString().slice(0, 10),
        note: input.note ?? null,
      }),
    );
  }

  async removeCashTx(id: string) {
    const found = await this.cashtx.findOneBy({ id });
    if (!found) throw new NotFoundException('ไม่พบรายการ');
    await this.cashtx.delete(id);
  }

  // ---- เงินสดในมือ ----
  async cashPosition() {
    const { openingCash } = await this.getOpening();
    const loans = await this.loans.find();
    const pays = await this.payments.find();
    const txs = await this.cashtx.find();

    const disbursed = loans
      .filter((l) => l.fromCapital)
      .reduce((s, l) => s + l.principalOriginal, 0);
    const collected = pays.reduce((s, p) => s + p.amount, 0);
    const sumTx = (t: CashTxType) =>
      txs.filter((x) => x.type === t).reduce((s, x) => s + x.amount, 0);
    const capitalIn = sumTx('CAPITAL_IN');
    const capitalOut = sumTx('CAPITAL_OUT');
    const otherIncome = sumTx('INCOME');
    const expense = sumTx('EXPENSE');

    const cashInHand = round2(
      openingCash +
        collected +
        capitalIn +
        otherIncome -
        disbursed -
        capitalOut -
        expense,
    );

    return {
      openingCash,
      disbursed,
      collected,
      capitalIn,
      capitalOut,
      otherIncome,
      expense,
      cashInHand,
    };
  }

  // ---- สมุดธุรกรรมรวม (ledger) ----
  async ledger(opts: { month?: string; limit?: number } = {}) {
    const loans = await this.loans.find({ relations: { debtor: true } });
    const pays = await this.payments.find({ relations: { loan: { debtor: true } } });
    const txs = await this.cashtx.find();
    const loanById = new Map(loans.map((l) => [l.id, l]));

    const entries: LedgerEntry[] = [];

    for (const l of loans) {
      if (l.fromCapital)
        entries.push({
          date: l.startDate,
          kind: 'ปล่อยกู้',
          detail: `${l.debtor?.name ?? ''} — ต้น ฿${l.principalOriginal}`,
          cashIn: 0,
          cashOut: l.principalOriginal,
        });
    }
    for (const p of pays) {
      const loan = loanById.get(p.loanId);
      const name = loan?.debtor?.name ?? '';
      const parts = p.onDeadLoan
        ? [loan?.installmentCount != null ? 'ผ่อนสินค้า' : 'ผ่อนยอดตาย']
        : [
            p.arrearsPaid > 0 ? `ค้าง ${p.arrearsPaid}` : '',
            p.interestPaid > 0 ? `ดอก ${p.interestPaid}` : '',
            p.principalPaid > 0 ? `ต้น ${p.principalPaid}` : '',
          ].filter(Boolean);
      entries.push({
        date: p.paidDate,
        kind: 'รับเงิน',
        detail: `${name} — ${parts.join(' / ')}`,
        cashIn: p.amount,
        cashOut: 0,
      });
    }
    const txLabel: Record<CashTxType, string> = {
      CAPITAL_IN: 'เติมทุน',
      CAPITAL_OUT: 'ถอนทุน',
      INCOME: 'รายรับอื่น',
      EXPENSE: 'รายจ่าย',
    };
    for (const t of txs) {
      const isIn = t.type === 'CAPITAL_IN' || t.type === 'INCOME';
      entries.push({
        date: t.date,
        kind: txLabel[t.type],
        detail: t.note ?? '',
        cashIn: isIn ? t.amount : 0,
        cashOut: isIn ? 0 : t.amount,
      });
    }

    let rows = entries.sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
    if (opts.month) rows = rows.filter((r) => r.date.startsWith(opts.month!));
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return rows;
  }

  // ---- รายงานรายเดือน ----
  async monthly(month: string) {
    const rows = await this.ledger({ month });
    const pays = (await this.payments.find()).filter((p) =>
      p.paidDate.startsWith(month),
    );
    const cashIn = rows.reduce((s, r) => s + r.cashIn, 0);
    const cashOut = rows.reduce((s, r) => s + r.cashOut, 0);
    const interest = pays.reduce((s, p) => s + p.interestPaid + p.arrearsPaid, 0);
    const principalBack = pays.reduce((s, p) => s + p.principalPaid, 0);
    return {
      month,
      cashIn: round2(cashIn),
      cashOut: round2(cashOut),
      net: round2(cashIn - cashOut),
      interestEarned: round2(interest),
      principalBack: round2(principalBack),
      entries: rows,
    };
  }

  // ---- แนวโน้มเก็บเงินรายวัน (n วันล่าสุด) ----
  async dailyTrend(days = 30) {
    const pays = await this.payments.find();
    const byDay = new Map<string, { collected: number; interest: number }>();
    for (const p of pays) {
      const cur = byDay.get(p.paidDate) ?? { collected: 0, interest: 0 };
      cur.collected += p.amount;
      cur.interest += p.interestPaid + p.arrearsPaid;
      byDay.set(p.paidDate, cur);
    }
    const out: { date: string; collected: number; interest: number }[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const v = byDay.get(key) ?? { collected: 0, interest: 0 };
      out.push({ date: key, collected: round2(v.collected), interest: round2(v.interest) });
    }
    return out;
  }

  // ---- CSV export ----
  async ledgerCsv(month?: string): Promise<string> {
    const rows = await this.ledger({ month });
    const header = 'วันที่,ประเภท,รายละเอียด,เงินเข้า,เงินออก';
    const body = rows
      .map((r) => {
        const detail = `"${(r.detail ?? '').replace(/"/g, '""')}"`;
        return [r.date, r.kind, detail, r.cashIn || '', r.cashOut || ''].join(
          ',',
        );
      })
      .join('\n');
    // BOM ให้ Excel อ่านภาษาไทยถูก
    return '﻿' + header + '\n' + body;
  }
}
