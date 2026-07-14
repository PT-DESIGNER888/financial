import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Loan } from './loan.entity';

@Entity('debtors')
export class Debtor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  /** ลิงก์เฟซบุ๊ก — กดเปิดโปรไฟล์ได้เลย */
  @Column({ type: 'varchar', nullable: true })
  facebookUrl: string | null;

  /** LINE ID หรือลิงก์ (https://line.me/ti/p/…) */
  @Column({ type: 'varchar', nullable: true })
  lineId: string | null;

  /** ญาติ/ผู้ติดต่อสำรอง (นอกจากผู้ค้ำ) */
  @Column({ type: 'varchar', nullable: true })
  relativeName: string | null;

  @Column({ type: 'varchar', nullable: true })
  relativePhone: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** ขึ้นบัญชีดำ — เตือนก่อนปล่อยกู้เพิ่ม */
  @Column({ default: false })
  blacklisted: boolean;

  /** ประวัติเครดิต/พฤติกรรมการจ่าย (จดอิสระ) */
  @Column({ type: 'text', nullable: true })
  creditNote: string | null;

  /** ผู้ค้ำประกัน */
  @Column({ type: 'varchar', nullable: true })
  guarantorName: string | null;

  @Column({ type: 'varchar', nullable: true })
  guarantorPhone: string | null;

  /**
   * ผู้ติดต่อคนสนิทหลายคน — JSON array
   * { name, phone?, line?, note? }[]
   */
  @Column({ type: 'simple-json', nullable: true })
  emergencyContacts: Array<{
    name: string;
    phone?: string;
    line?: string;
    note?: string;
  }> | null;

  @OneToMany(() => Loan, (loan) => loan.debtor)
  loans: Loan[];

  @CreateDateColumn()
  createdAt: Date;
}
