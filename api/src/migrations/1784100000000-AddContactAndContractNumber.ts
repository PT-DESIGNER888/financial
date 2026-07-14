import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1) debtors: เพิ่มช่องทางติดต่อ (เฟซบุ๊ก / LINE / ญาติ)
 * 2) loans: เพิ่มเลขที่สัญญา (L-<ปี พ.ศ.>-<ลำดับ 4 หลัก>) + backfill สัญญาเก่า
 *    เรียงตามวันสร้างภายในปีของวันเปิดยอด
 */
export class AddContactAndContractNumber1784100000000
  implements MigrationInterface
{
  name = 'AddContactAndContractNumber1784100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "debtors" ADD "facebookUrl" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "debtors" ADD "lineId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "debtors" ADD "relativeName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "debtors" ADD "relativePhone" character varying`,
    );

    await queryRunner.query(
      `ALTER TABLE "loans" ADD "contractNumber" character varying`,
    );
    await queryRunner.query(`
      UPDATE "loans" SET "contractNumber" = sub.cn
      FROM (
        SELECT id,
          'L-' || (EXTRACT(YEAR FROM "startDate")::int + 543) || '-' ||
          LPAD(
            (ROW_NUMBER() OVER (
              PARTITION BY EXTRACT(YEAR FROM "startDate")
              ORDER BY "createdAt", id
            ))::text, 4, '0'
          ) AS cn
        FROM "loans"
      ) sub
      WHERE "loans".id = sub.id
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_loans_contractNumber" ON "loans" ("contractNumber")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_loans_contractNumber"`);
    await queryRunner.query(`ALTER TABLE "loans" DROP COLUMN "contractNumber"`);
    await queryRunner.query(
      `ALTER TABLE "debtors" DROP COLUMN "relativePhone"`,
    );
    await queryRunner.query(`ALTER TABLE "debtors" DROP COLUMN "relativeName"`);
    await queryRunner.query(`ALTER TABLE "debtors" DROP COLUMN "lineId"`);
    await queryRunner.query(`ALTER TABLE "debtors" DROP COLUMN "facebookUrl"`);
  }
}
