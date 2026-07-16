import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PaymentType } from '../common/enums';
import { Loan } from './loan.entity';

// re-export ให้โค้ดเดิมที่ import จาก entity ใช้ได้ต่อ — นิยามจริงอยู่ที่ common/enums
export { PaymentType } from '../common/enums';

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

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Loan, (l) => l.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @Column()
  loanId: string;

  @Column({ type: 'date' })
  paidDate: string;

  /** ยอดรวมที่รับ = arrearsPaid + interestPaid + principalPaid */
  @Column(money)
  amount: number;

  /** ส่วนที่หักยอดค้างเก่า */
  @Column({ ...money, default: 0 })
  arrearsPaid: number;

  /** ส่วนที่จ่ายดอกรอบวันนั้น */
  @Column({ ...money, default: 0 })
  interestPaid: number;

  /** ส่วนที่ตัดต้น (ยอดปกติ) หรือผ่อนยอดตาย */
  @Column({ ...money, default: 0 })
  principalPaid: number;

  /** true = จ่ายเข้ายอดตาย (ลด deadBalance) */
  @Column({ default: false })
  onDeadLoan: boolean;

  /** ประเภทการรับชำระที่เลือกตอนบันทึก — null = รายการเก่าก่อนมีฟีเจอร์ */
  @Column({ type: 'varchar', nullable: true })
  paymentType: PaymentType | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
