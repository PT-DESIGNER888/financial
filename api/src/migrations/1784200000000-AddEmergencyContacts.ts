import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmergencyContacts1784200000000 implements MigrationInterface {
  name = 'AddEmergencyContacts1784200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "debtors" ADD "emergencyContacts" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "debtors" DROP COLUMN "emergencyContacts"`,
    );
  }
}
