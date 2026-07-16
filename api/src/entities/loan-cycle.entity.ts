import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Loan } from './loan.entity';

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

/**
 * รอบเก็บดอกของยอดดอกลอย/คงที่ (สถานะ ACTIVE) — สร้างล่วงหน้าอัตโนมัติ
 * ตามรอบเก็บ (รายวัน / 7 วัน / 10 วัน) และแก้ไขรายรอบได้:
 *   - dueDate เลื่อนได้ (รอบที่ยังไม่สะสมเข้ายอดค้าง)
 *   - interestOverride แทนดอกที่ระบบคำนวณ (ตกลงลดดอกกับลูกหนี้)
 */
@Entity('loan_cycles')
@Index(['loanId', 'dueDate'])
export class LoanCycle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Loan, (l) => l.cycles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @Column()
  loanId: string;

  /** วันครบกำหนดรอบนี้ — แก้/เลื่อนได้จนกว่าจะถูกสะสมเข้ายอดค้าง */
  @Column({ type: 'date' })
  dueDate: string;

  /** ยอดดอกที่ตกลงเก็บจริง — null = ใช้ที่ระบบคำนวณจากต้นคงเหลือ ณ ตอนสะสม */
  @Column({ ...money, nullable: true })
  interestOverride: number | null;

  /** รอบนี้ถูกสะสมเข้ายอดค้างแล้ว (ผ่านวันครบกำหนดไปแล้ว) — ห้ามแก้ต่อ */
  @Column({ default: false })
  accrued: boolean;

  /** ส่วนที่เข้ายอดค้างจริงตอนสะสม (ดอกรอบนี้ − ที่จ่ายมาแล้วในรอบ) */
  @Column({ ...money, nullable: true })
  accruedAmount: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
