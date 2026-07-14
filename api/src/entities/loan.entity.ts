import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Debtor } from './debtor.entity';
import { Payment } from './payment.entity';

export type LoanStatus =
  | 'ACTIVE'
  | 'DEAD'
  | 'INSTALLMENT'
  | 'CLOSED'
  | 'BAD_DEBT';
export type LoanCycle = 'DAILY' | 'TEN_DAY';
/** FLOATING = ดอกลอย (จากต้นคงเหลือ), FLAT = ดอกคงที่ (จากต้นเดิม ไม่ลดตามตัดต้น) */
export type InterestMode = 'FLOATING' | 'FLAT';

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

  @Column({ type: 'varchar', default: 'ACTIVE' })
  status: LoanStatus;

  @Column({ type: 'varchar' })
  cycle: LoanCycle;

  @Column({ type: 'varchar', default: 'FLOATING' })
  interestMode: InterestMode;

  /** เงินต้นตอนเปิดยอด */
  @Column(money)
  principalOriginal: number;

  /** ต้นคงเหลือ — ฐานคำนวณดอก */
  @Column(money)
  outstandingPrincipal: number;

  /** % ของต้นคงเหลือ ต่อรอบเก็บ */
  @Column({ type: 'numeric', precision: 6, scale: 3, transformer: money.transformer })
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

  /** ผ่อนงวด: ยอดเต็มที่ต้องผ่อนทั้งสัญญา (ต้น + ดอกรวม) */
  @Column({ ...money, nullable: true })
  installmentTotal: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** true = เงินต้นถูกปล่อยออกจากเงินสดในมือตอนเปิดยอด (ยอดใหม่)
   *  false = ยอดเก่าที่ปล่อยไปก่อนขึ้นระบบ (ไม่หักเงินสดซ้ำ) */
  @Column({ default: true })
  fromCapital: boolean;

  @OneToMany(() => Payment, (p) => p.loan)
  payments: Payment[];

  @Column({ type: 'date', nullable: true })
  closedAt: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
