import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * นัดชำระดอก: จดวันไปเก็บดอกเป็นก้อน (คิดรายรอบตามเดิมจนถึงวันนัด)
 * ยอดเก่าทั้งหมด null = ไม่มีนัด ไม่กระทบการคำนวณ
 */
export class AddInterestAppointment1784600000000 implements MigrationInterface {
  name = 'AddInterestAppointment1784600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "interestDueDate" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "interestDueAmount" numeric(12,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN IF EXISTS "interestDueAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN IF EXISTS "interestDueDate"`,
    );
  }
}
