import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InterestMode, LoanCycle, LoanStatus } from '../common/enums';
import { Debtor } from './debtor.entity';
import { LoanCycle as CycleRow } from './loan-cycle.entity';
import { Payment } from './payment.entity';

// re-export ให้โค้ดเดิมที่ import จาก entity ใช้ได้ต่อ — นิยามจริงอยู่ที่ common/enums
export { InterestMode, LoanCycle, LoanStatus } from '../common/enums';

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

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Debtor, (d) => d.loans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debtorId' })
  debtor: Debtor;

  @Column()
  debtorId: string;

  /** เลขที่สัญญา เช่น L-2569-0001 (ปี พ.ศ. + ลำดับในปีนั้น) — gen อัตโนมัติตอนเปิดยอด */
  @Column({ type: 'varchar', nullable: true })
  contractNumber: string | null;

  @Column({ type: 'varchar', default: LoanStatus.ACTIVE })
  status: LoanStatus;

  @Column({ type: 'varchar' })
  cycle: LoanCycle;

  @Column({ type: 'varchar', default: InterestMode.FLOATING })
  interestMode: InterestMode;

  /** เงินต้นตอนเปิดยอด */
  @Column(money)
  principalOriginal: number;

  /** ต้นคงเหลือ — ฐานคำนวณดอก */
  @Column(money)
  outstandingPrincipal: number;

  /** % ของต้นคงเหลือ ต่อรอบเก็บ */
  @Column({
    type: 'numeric',
    precision: 6,
    scale: 3,
    transformer: money.transformer,
  })
  interestRatePercent: number;

  /** ดอกถึงกำหนดแล้วยังไม่จ่าย (ไม่คิดดอกทบ) */
  @Column({ ...money, default: 0 })
  arrears: number;

  /** วันเปิดยอด — รอบแรกถึงกำหนดวันถัดไป (รายวัน) หรือ +10 วัน (ราย 10 วัน) */
  @Column({ type: 'date' })
  startDate: string;

  /** คิดยอดค้างสะสมถึงวันนี้แล้ว (รวมวันนั้น) */
  @Column({ type: 'date' })
  accruedThrough: string;

  /** วันแปลงเป็นยอดตาย */
  @Column({ type: 'date', nullable: true })
  deadDate: string | null;

  /** ยอดตรึง ณ วันแปลง (ต้น + ค้าง) ที่ยังเหลือให้ผ่อน */
  @Column({ ...money, nullable: true })
  deadBalance: number | null;

  /** งวดผ่อน (ยอดตาย = ทุก 10 วัน, ผ่อนงวด = ต่องวดตามรอบ) */
  @Column({ ...money, nullable: true })
  installmentAmount: number | null;

  /** ผ่อนงวด: จำนวนงวดทั้งหมด (N) — null = ไม่ใช่ยอดผ่อนงวด */
  @Column({ type: 'int', nullable: true })
  installmentCount: number | null;

  /** ยอดผ่อน: ยอดเต็มที่ต้องชำระทั้งสัญญา (ต้น + ดอกรวม + ค่าธรรมเนียม) */
  @Column({ ...money, nullable: true })
  installmentTotal: number | null;

  /** ยอดผ่อน: ลดต้นลดดอก — ดอกคิดจากต้นคงเหลือต่องวด (false = ดอกคงที่หารเท่ากัน) */
  @Column({ default: false })
  amortized: boolean;

  /** ค่าธรรมเนียมเพิ่มเติม (รวมเข้ายอดที่ต้องชำระ เก็บกับงวดแรก) */
  @Column({ ...money, default: 0 })
  fee: number;

  /** วันครบกำหนดงวดแรก — null = อัตโนมัติ (วันเปิดยอด + 1 รอบ) */
  @Column({ type: 'date', nullable: true })
  firstDueDate: string | null;

  /** นัดคืนต้น: วันที่ลูกหนี้ตกลงจะเอาเงินก้อนมาตัดต้น (จดไว้ ไม่ผูกรอบดอก) */
  @Column({ type: 'date', nullable: true })
  principalDueDate: string | null;

  /** นัดคืนต้น: ยอดที่ตกลงจะคืน — null = ยังไม่ระบุยอด */
  @Column({ ...money, nullable: true })
  principalDueAmount: number | null;

  /** ปัดยอดต่องวดเป็นบาทเต็ม (เศษไปรวมงวดสุดท้าย) */
  @Column({ default: false })
  roundInstallments: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** true = เงินต้นถูกปล่อยออกจากเงินสดในมือตอนเปิดยอด (ยอดใหม่)
   *  false = ยอดเก่าที่ปล่อยไปก่อนขึ้นระบบ (ไม่หักเงินสดซ้ำ) */
  @Column({ default: true })
  fromCapital: boolean;

  @OneToMany(() => Payment, (p) => p.loan)
  payments: Payment[];

  /** รอบเก็บดอก (เฉพาะยอดดอกลอย/คงที่ ACTIVE) — gen อัตโนมัติ แก้รายรอบได้ */
  @OneToMany(() => CycleRow, (c) => c.loan)
  cycles: CycleRow[];

  @Column({ type: 'date', nullable: true })
  closedAt: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
