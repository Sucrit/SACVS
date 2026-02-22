/*
  Warnings:

  - You are about to drop the column `status` on the `Employer` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Institution` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Employer" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Institution" DROP COLUMN "status";
