import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * นัดคืนต้น: ลูกหนี้ตกลงว่าจะเอาเงินก้อนมาตัดต้นวันไหน ยอดเท่าไหร่
 * (จดไว้เฉยๆ ไม่ผูกกับรอบดอก — ถึงวันแล้วโผล่ในหน้าเก็บวันนี้)
 * ยอดเก่าทั้งหมด null = ไม่มีนัด ไม่กระทบการคำนวณ
 */
export class AddPrincipalAppointment1784400000000 implements MigrationInterface {
  name = 'AddPrincipalAppointment1784400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "principalDueDate" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "principalDueAmount" numeric(12,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN IF EXISTS "principalDueAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN IF EXISTS "principalDueDate"`,
    );
  }
}
