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
    // เลือกเฉพาะคอลัมน์ที่ใช้คำนวณ — ไม่ดึงทั้งแถว
    const loans = await this.loans.find({
      select: {
        id: true,
        fromCapital: true,
        capitalDisbursed: true,
        principalOriginal: true,
      },
    });
    const collectedRow = await this.payments
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'collected')
      .getRawOne<{ collected: string }>();
    const collected = parseFloat(String(collectedRow?.collected ?? 0)) || 0;
    const txs = await this.cashtx.find({
      select: { id: true, type: true, amount: true },
    });

    const disbursed = loans
      .filter((l) => l.fromCapital)
      .reduce((s, l) => s + (l.capitalDisbursed ?? l.principalOriginal), 0);
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
    const loans = await this.loans.find({
      relations: { debtor: true },
      relationLoadStrategy: 'query',
    });
    // โหลด payments แบนๆ แล้ว map ชื่อจาก loans — ไม่ join loan.debtor ซ้ำทุกแถว
    const paysQb = this.payments.createQueryBuilder('p');
    if (opts.month) {
      paysQb.where('p.paidDate LIKE :m', { m: `${opts.month}%` });
    }
    const pays = await paysQb.getMany();
    const txsQb = this.cashtx.createQueryBuilder('t');
    if (opts.month) {
      txsQb.where('t.date LIKE :m', { m: `${opts.month}%` });
    }
    const txs = await txsQb.getMany();
    const loanById = new Map(loans.map((l) => [l.id, l]));

    const entries: LedgerEntry[] = [];

    for (const l of loans) {
      if (l.fromCapital) {
        if (opts.month && !l.startDate.startsWith(opts.month)) continue;
        // รียอด: เงินสดออกจริง = capitalDisbursed (ต้นใหม่ − ยอดเหลือเดิมที่ยกมา)
        const cashOut = l.capitalDisbursed ?? l.principalOriginal;
        entries.push({
          date: l.startDate,
          kind: l.refinancedFromId ? 'รียอด (ปล่อยเพิ่ม)' : 'ปล่อยกู้',
          detail: `${l.debtor?.name ?? ''} — ${
            l.refinancedFromId
              ? `ต้นใหม่ ฿${l.principalOriginal} · จ่ายเพิ่ม ฿${cashOut}`
              : `ต้น ฿${l.principalOriginal}`
          }`,
          cashIn: 0,
          cashOut,
        });
      }
    }
    for (const p of pays) {
      const loan = loanById.get(p.loanId);
      const name = loan?.debtor?.name ?? '';
      const parts = p.onDeadLoan
        ? [loan?.installmentCount != null ? 'ผ่อนงวด' : 'ผ่อนยอดตาย']
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
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return rows;
  }

  // ---- รายงานรายเดือน ----
  async monthly(month: string) {
    const rows = await this.ledger({ month });
    const interestRow = await this.payments
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.interestPaid + p.arrearsPaid), 0)', 'interest')
      .addSelect('COALESCE(SUM(p.principalPaid), 0)', 'principal')
      .where('p.paidDate LIKE :m', { m: `${month}%` })
      .getRawOne<{ interest: string; principal: string }>();
    const cashIn = rows.reduce((s, r) => s + r.cashIn, 0);
    const cashOut = rows.reduce((s, r) => s + r.cashOut, 0);
    return {
      month,
      cashIn: round2(cashIn),
      cashOut: round2(cashOut),
      net: round2(cashIn - cashOut),
      interestEarned: round2(
        parseFloat(String(interestRow?.interest ?? 0)) || 0,
      ),
      principalBack: round2(
        parseFloat(String(interestRow?.principal ?? 0)) || 0,
      ),
      entries: rows,
    };
  }

  // ---- แนวโน้มเก็บเงินรายวัน (n วันล่าสุด) ----
  async dailyTrend(days = 30) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const startKey = start.toISOString().slice(0, 10);
    const rows = await this.payments
      .createQueryBuilder('p')
      .select('p.paidDate', 'date')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'collected')
      .addSelect('COALESCE(SUM(p.interestPaid + p.arrearsPaid), 0)', 'interest')
      .where('p.paidDate >= :start', { start: startKey })
      .groupBy('p.paidDate')
      .getRawMany<{ date: string; collected: string; interest: string }>();
    const byDay = new Map(
      rows.map((r) => [
        r.date,
        {
          collected: parseFloat(String(r.collected)) || 0,
          interest: parseFloat(String(r.interest)) || 0,
        },
      ]),
    );
    const out: { date: string; collected: number; interest: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const v = byDay.get(key) ?? { collected: 0, interest: 0 };
      out.push({
        date: key,
        collected: round2(v.collected),
        interest: round2(v.interest),
      });
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
