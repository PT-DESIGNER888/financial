import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * โครงตารางเริ่มต้นทั้งหมด (Postgres/Supabase) — ตรงกับ entities ณ 2026-07-12
 * dev บน SQLite ยังใช้ synchronize อยู่ migration นี้ใช้เฉพาะฝั่ง Postgres
 */
export class InitialSchema1783900000000 implements MigrationInterface {
  name = 'InitialSchema1783900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // gen_random_uuid() มากับ pgcrypto (Supabase เปิดให้อยู่แล้ว — กันเหนียวไว้)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "username" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "displayName" character varying,
        "role" character varying NOT NULL DEFAULT 'OWNER',
        "isActive" boolean NOT NULL DEFAULT true,
        "lastLoginAt" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_username" UNIQUE ("username")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "debtors" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "phone" character varying,
        "note" text,
        "blacklisted" boolean NOT NULL DEFAULT false,
        "creditNote" text,
        "guarantorName" character varying,
        "guarantorPhone" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "loans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "debtorId" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "cycle" character varying NOT NULL,
        "interestMode" character varying NOT NULL DEFAULT 'FLOATING',
        "principalOriginal" numeric(12,2) NOT NULL,
        "outstandingPrincipal" numeric(12,2) NOT NULL,
        "interestRatePercent" numeric(6,3) NOT NULL,
        "arrears" numeric(12,2) NOT NULL DEFAULT 0,
        "startDate" date NOT NULL,
        "accruedThrough" date NOT NULL,
        "deadDate" date,
        "deadBalance" numeric(12,2),
        "installmentAmount" numeric(12,2),
        "installmentCount" integer,
        "installmentTotal" numeric(12,2),
        "note" text,
        "fromCapital" boolean NOT NULL DEFAULT true,
        "closedAt" date,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_loans_debtor" FOREIGN KEY ("debtorId")
          REFERENCES "debtors"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "loanId" uuid NOT NULL,
        "paidDate" date NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "arrearsPaid" numeric(12,2) NOT NULL DEFAULT 0,
        "interestPaid" numeric(12,2) NOT NULL DEFAULT 0,
        "principalPaid" numeric(12,2) NOT NULL DEFAULT 0,
        "onDeadLoan" boolean NOT NULL DEFAULT false,
        "note" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_payments_loan" FOREIGN KEY ("loanId")
          REFERENCES "loans"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "activities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" character varying NOT NULL,
        "debtorId" character varying,
        "loanId" character varying,
        "debtorName" character varying,
        "message" text NOT NULL,
        "reason" text,
        "amount" numeric(12,2),
        "meta" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_activities_debtorId" ON "activities" ("debtorId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "cash_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" character varying NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "date" date NOT NULL,
        "note" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cash_transactions_date" ON "cash_transactions" ("date")`,
    );

    await queryRunner.query(`
      CREATE TABLE "settings" (
        "key" character varying PRIMARY KEY,
        "value" text,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "attachments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "debtorId" character varying NOT NULL,
        "kind" character varying NOT NULL,
        "filename" character varying NOT NULL,
        "path" character varying NOT NULL,
        "url" text NOT NULL,
        "note" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_attachments_debtorId" ON "attachments" ("debtorId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ลบตามลำดับกลับ (ลูกก่อนแม่ ตาม FK)
    await queryRunner.query(`DROP TABLE "attachments"`);
    await queryRunner.query(`DROP TABLE "settings"`);
    await queryRunner.query(`DROP TABLE "cash_transactions"`);
    await queryRunner.query(`DROP TABLE "activities"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "loans"`);
    await queryRunner.query(`DROP TABLE "debtors"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
