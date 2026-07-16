import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * รายการเงินสด "นอกยอดกู้" ที่ผู้ใช้บันทึกเอง — ใช้คำนวณเงินสดในมือ
 *  CAPITAL_IN  เติมทุน (เอาเงินส่วนตัวมาลงเพิ่ม)
 *  CAPITAL_OUT ถอนทุน (ดึงเงินออกไปใช้ส่วนตัว)
 *  INCOME      รายรับอื่น (ค่าปรับ ค่าธรรมเนียม ฯลฯ)
 *  EXPENSE     รายจ่าย (ค่าเดินทาง ค่าน้ำมัน ฯลฯ)
 * (เงินปล่อยกู้/เงินเก็บได้ ไม่บันทึกที่นี่ — ดึงจาก loans/payments อัตโนมัติ)
 */
import { CashTxType } from '../common/enums';

// re-export ให้โค้ดเดิมที่ import จาก entity ใช้ได้ต่อ — นิยามจริงอยู่ที่ common/enums
export { CashTxType } from '../common/enums';

const money = {
  type: 'numeric' as const,
  precision: 12,
  scale: 2,
  transformer: {
    to: (v: number | null) => v,
    from: (v: string | number | null) =>
      v === null || v === undefined ? null : parseFloat(String(v)),
  },
};

@Entity('cash_transactions')
export class CashTx {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: CashTxType;

  @Column(money)
  amount: number;

  @Index()
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
