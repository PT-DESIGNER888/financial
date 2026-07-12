import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Activity } from '../entities/activity.entity';
import { Attachment } from '../entities/attachment.entity';
import { CashTx } from '../entities/cash-tx.entity';
import { Debtor } from '../entities/debtor.entity';
import { Loan } from '../entities/loan.entity';
import { Payment } from '../entities/payment.entity';
import { Setting } from '../entities/setting.entity';

@Injectable()
export class BackupService {
  constructor(@InjectDataSource() private ds: DataSource) {}

  /** ส่งออกข้อมูลทั้งหมด (ยกเว้นผู้ใช้/รหัสผ่าน) เป็น JSON */
  async export() {
    const [debtors, loans, payments, activities, cashtx, settings, attachments] =
      await Promise.all([
        this.ds.getRepository(Debtor).find(),
        this.ds.getRepository(Loan).find(),
        this.ds.getRepository(Payment).find(),
        this.ds.getRepository(Activity).find(),
        this.ds.getRepository(CashTx).find(),
        this.ds.getRepository(Setting).find(),
        this.ds.getRepository(Attachment).find(),
      ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      debtors,
      loans,
      payments,
      activities,
      cashtx,
      settings,
      attachments,
    };
  }

  /** กู้คืนจาก JSON — ล้างข้อมูลเดิมทั้งหมดก่อน (ไม่แตะผู้ใช้) */
  async import(data: Record<string, unknown[]>) {
    await this.ds.transaction(async (m) => {
      // ลบลูกก่อนแม่ (เลี่ยง FK)
      await m.getRepository(Payment).delete({});
      await m.getRepository(Attachment).delete({});
      await m.getRepository(Activity).delete({});
      await m.getRepository(CashTx).delete({});
      await m.getRepository(Setting).delete({});
      await m.getRepository(Loan).delete({});
      await m.getRepository(Debtor).delete({});
      // ใส่แม่ก่อนลูก
      const save = async (entity: any, rows?: unknown[]) => {
        if (rows && rows.length) await m.getRepository(entity).save(rows as any);
      };
      await save(Debtor, data.debtors);
      await save(Loan, data.loans);
      await save(Payment, data.payments);
      await save(Activity, data.activities);
      await save(CashTx, data.cashtx);
      await save(Setting, data.settings);
      await save(Attachment, data.attachments);
    });
    return { ok: true };
  }
}
