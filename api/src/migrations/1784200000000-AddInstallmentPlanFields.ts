import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ยอดผ่อนเป็นงวด: รองรับลดต้นลดดอก / รอบรายเดือน-รายสัปดาห์ /
 * ค่าธรรมเนียม / วันเริ่มชำระเลือกเอง / ปัดยอดต่องวด
 * ยอดเก่าทั้งหมดเป็นดอกคงที่เดิม → default false/0/null ไม่กระทบการคำนวณ
 */
export class AddInstallmentPlanFields1784200000000
  implements MigrationInterface
{
  name = 'AddInstallmentPlanFields1784200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" ADD "amortized" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD "fee" numeric(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE "loans" ADD "firstDueDate" date`);
    await queryRunner.query(
      `ALTER TABLE "loans" ADD "roundInstallments" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" DROP COLUMN "roundInstallments"`,
    );
    await queryRunner.query(`ALTER TABLE "loans" DROP COLUMN "firstDueDate"`);
    await queryRunner.query(`ALTER TABLE "loans" DROP COLUMN "fee"`);
    await queryRunner.query(`ALTER TABLE "loans" DROP COLUMN "amortized"`);
  }
}
