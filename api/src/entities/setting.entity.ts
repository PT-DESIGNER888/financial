import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** ตั้งค่าแบบ key-value (ผู้ใช้คนเดียว) — เช่น เงินทุนตั้งต้น, วันเริ่มใช้ระบบ */
@Entity('settings')
export class Setting {
  @PrimaryColumn({ type: 'varchar' })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
