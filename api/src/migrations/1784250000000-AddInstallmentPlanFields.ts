import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ยอดผ่อนเป็นงวด: รองรับลดต้นลดดอก / รอบรายเดือน-รายสัปดาห์ /
 * ค่าธรรมเนียม / วันเริ่มชำระเลือกเอง / ปัดยอดต่องวด
 * ยอดเก่าทั้งหมดเป็นดอกคงที่เดิม → default false/0/null ไม่กระทบการคำนวณ
 *
 * ใช้ IF NOT EXISTS/IF EXISTS เพื่อให้รันซ้ำได้ปลอดภัย
 * (migration เดิมเคยใช้ timestamp 1784200000000 ซ้ำกับ AddEmergencyContacts)
 */
export class AddInstallmentPlanFields1784250000000 implements MigrationInterface {
  name = 'AddInstallmentPlanFields1784250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "amortized" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "fee" numeric(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "firstDueDate" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "roundInstallments" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN IF EXISTS "roundInstallments"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN IF EXISTS "firstDueDate"`,
    );
    await queryRunner.query(`ALTER TABLE "loans" DROP COLUMN IF EXISTS "fee"`);
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN IF EXISTS "amortized"`,
    );
  }
}
