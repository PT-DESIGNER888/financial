import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** OWNER = เจ้าของ (สิทธิ์เต็ม), STAFF = เผื่ออนาคตมีลูกทีมช่วยเก็บเงิน */
export type UserRole = 'OWNER' | 'STAFF';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  /** ชื่อที่แสดงในระบบ (เผื่อหลายคนจะได้รู้ว่าใครทำรายการ) */
  @Column({ type: 'varchar', nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', default: 'OWNER' })
  role: UserRole;

  /** false = ระงับการใช้งาน (ไม่ลบทิ้ง ประวัติยังอ้างอิงได้) */
  @Column({ default: true })
  isActive: boolean;

  /** เวลา login ล่าสุด (ISO string — พกพาได้ทั้ง SQLite/Postgres) */
  @Column({ type: 'varchar', nullable: true })
  lastLoginAt: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
