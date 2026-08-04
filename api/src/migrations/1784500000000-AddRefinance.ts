import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * รียอด (ปิดสัญญาเก่า เปิดสัญญาใหม่ยกยอดเหลือมา):
 * - capitalDisbursed = เงินสดที่ปล่อยจริงตอนเปิดยอด (null = ใช้ principalOriginal)
 *   ยอดรียอดต้นใหม่รวมยอดเหลือเดิม แต่เงินสดออกจริง = ต้นใหม่ − ยอดเหลือเดิม
 * - refinancedFromId = สัญญาเดิมที่ปิดไปตอนเปิดยอดนี้ (โยงประวัติ)
 * ยอดเก่าทั้งหมด null = ไม่กระทบการคำนวณเงินสดเดิม
 */
export class AddRefinance1784500000000 implements MigrationInterface {
  name = 'AddRefinance1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "capitalDisbursed" numeric(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "refinancedFromId" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN IF EXISTS "refinancedFromId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN IF EXISTS "capitalDisbursed"`,
    );
  }
}
