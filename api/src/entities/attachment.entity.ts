import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AttachmentKind } from '../common/enums';

// re-export ให้โค้ดเดิมที่ import จาก entity ใช้ได้ต่อ — นิยามจริงอยู่ที่ common/enums
export { AttachmentKind } from '../common/enums';

/** ไฟล์แนบของลูกหนี้ (สลิปโอน / บัตรประชาชน) — เก็บไฟล์จริงที่ Supabase Storage เก็บแค่ URL ที่นี่ */
@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  debtorId: string;

  @Column({ type: 'varchar' })
  kind: AttachmentKind;

  @Column({ type: 'varchar' })
  filename: string;

  /** path ใน bucket (ใช้ตอนลบ) */
  @Column({ type: 'varchar' })
  path: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
