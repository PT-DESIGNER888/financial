import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ดอกลอยตาม requirement ลูกค้า:
 *   - loan_cycles: รอบเก็บดอกเป็นแถว แก้วันครบกำหนด/ยอดดอกรายรอบได้
 *   - payments.paymentType: ประเภทการรับชำระ (ชำระดอก / ลดต้น / ดอก+ลดต้น)
 * ยอดเก่า: ไม่มีแถวรอบดอก → ระบบ gen ต่อจาก accruedThrough อัตโนมัติ ไม่สะสมย้อนซ้ำ
 */
export class AddLoanCyclesAndPaymentType1784300000000
  implements MigrationInterface
{
  name = 'AddLoanCyclesAndPaymentType1784300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "loan_cycles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loanId" uuid NOT NULL,
        "dueDate" date NOT NULL,
        "interestOverride" numeric(12,2),
        "accrued" boolean NOT NULL DEFAULT false,
        "accruedAmount" numeric(12,2),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loan_cycles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_loan_cycles_loan" FOREIGN KEY ("loanId")
          REFERENCES "loans"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loan_cycles_loan_due" ON "loan_cycles" ("loanId", "dueDate")`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD "paymentType" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "paymentType"`);
    await queryRunner.query(`DROP INDEX "IDX_loan_cycles_loan_due"`);
    await queryRunner.query(`DROP TABLE "loan_cycles"`);
  }
}
