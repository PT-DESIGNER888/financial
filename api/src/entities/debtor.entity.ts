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

  @OneToMany(() => Loan, (loan) => loan.debtor)
  loans: Loan[];

  @CreateDateColumn()
  createdAt: Date;
}
