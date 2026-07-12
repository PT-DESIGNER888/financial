import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ActivityType =
  | 'ADJUST' // ปรับยอดด้วยมือ
  | 'CLOSE' // ปิดยอดเอง
  | 'REOPEN' // เปิดยอดคืน
  | 'WRITE_OFF' // ตัดหนี้สูญ
  | 'EDIT_LOAN' // แก้เงื่อนไขยอดกู้
  | 'DELETE_LOAN' // ลบยอดกู้
  | 'CONVERT_DEAD' // แปลงยอดตาย
  | 'EDIT_DEBTOR' // แก้ข้อมูลลูกหนี้
  | 'DELETE_DEBTOR'; // ลบลูกหนี้

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
 * บันทึกเหตุการณ์ที่ผู้ใช้ทำกับข้อมูล (audit log) — ปรับยอด/ปิด/หนี้สูญ/แก้/ลบ
 * เก็บ snapshot ชื่อลูกหนี้ไว้ด้วย เพราะ debtor/loan อาจถูกลบไปแล้ว
 * ใช้ต่อยอดเป็นสมุดธุรกรรม (ledger) ในเฟสรายงาน
 */
@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: ActivityType;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  debtorId: string | null;

  @Column({ type: 'varchar', nullable: true })
  loanId: string | null;

  /** snapshot ชื่อลูกหนี้ ณ เวลาบันทึก */
  @Column({ type: 'varchar', nullable: true })
  debtorName: string | null;

  /** ข้อความอ่านง่ายสำหรับแสดงในสมุดธุรกรรม */
  @Column({ type: 'text' })
  message: string;

  /** เหตุผล/หมายเหตุที่ผู้ใช้กรอก */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /** ผลกระทบต่อเงิน (เช่น จำนวนที่ตัดหนี้สูญ) — เซ็นได้ทั้งบวก/ลบ */
  @Column({ ...money, nullable: true })
  amount: number | null;

  /** ค่าก่อน/หลัง สำหรับการปรับยอด/แก้เงื่อนไข */
  @Column({ type: 'simple-json', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
