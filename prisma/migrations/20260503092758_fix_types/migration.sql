/*
  Warnings:

  - The `reservationId` column on the `Booking` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updatedAt` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `eventId` on the `Booking` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ticketbooking"."UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ticketbooking"."SeatState" AS ENUM ('AVAILABLE', 'RESERVED', 'BOOKED');

-- CreateEnum
CREATE TYPE "ticketbooking"."WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "ticketbooking"."ReferenceType" AS ENUM ('TOPUP_REQUEST', 'BOOKING', 'BOOKING_CANCEL');

-- CreateEnum
CREATE TYPE "ticketbooking"."PaymentMode" AS ENUM ('UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'NET_BANKING');

-- CreateEnum
CREATE TYPE "ticketbooking"."TopupStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "ticketbooking"."Booking" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "eventId",
ADD COLUMN     "eventId" INTEGER NOT NULL,
DROP COLUMN "reservationId",
ADD COLUMN     "reservationId" INTEGER;

-- CreateTable
CREATE TABLE "ticketbooking"."User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "ticketbooking"."UserRole" NOT NULL DEFAULT 'USER',
    "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticketbooking"."Event" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "venue" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "capacity" INTEGER NOT NULL,
    "ticketsSold" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticketbooking"."Seat" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "seatNumber" TEXT NOT NULL,
    "row" TEXT NOT NULL,
    "col" INTEGER NOT NULL,
    "state" "ticketbooking"."SeatState" NOT NULL DEFAULT 'AVAILABLE',
    "reservedBy" INTEGER,
    "reservedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticketbooking"."Reservation" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "seatNumbers" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticketbooking"."Wallet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticketbooking"."WalletTransaction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "type" "ticketbooking"."WalletTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" "ticketbooking"."ReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticketbooking"."WalletTopupRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMode" "ticketbooking"."PaymentMode" NOT NULL,
    "receiptUrl" TEXT,
    "receiptPublicId" TEXT,
    "declarationAccepted" BOOLEAN NOT NULL DEFAULT false,
    "status" "ticketbooking"."TopupStatus" NOT NULL DEFAULT 'PENDING',
    "adminId" INTEGER,
    "adminRemarks" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTopupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "ticketbooking"."User"("email");

-- CreateIndex
CREATE INDEX "Event_createdAt_idx" ON "ticketbooking"."Event"("createdAt");

-- CreateIndex
CREATE INDEX "Event_isActive_idx" ON "ticketbooking"."Event"("isActive");

-- CreateIndex
CREATE INDEX "Seat_state_idx" ON "ticketbooking"."Seat"("state");

-- CreateIndex
CREATE INDEX "Seat_eventId_idx" ON "ticketbooking"."Seat"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_eventId_seatNumber_key" ON "ticketbooking"."Seat"("eventId", "seatNumber");

-- CreateIndex
CREATE INDEX "Reservation_expiresAt_idx" ON "ticketbooking"."Reservation"("expiresAt");

-- CreateIndex
CREATE INDEX "Reservation_userId_idx" ON "ticketbooking"."Reservation"("userId");

-- CreateIndex
CREATE INDEX "Reservation_eventId_idx" ON "ticketbooking"."Reservation"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "ticketbooking"."Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userEmail_key" ON "ticketbooking"."Wallet"("userEmail");

-- CreateIndex
CREATE INDEX "WalletTransaction_userEmail_createdAt_idx" ON "ticketbooking"."WalletTransaction"("userEmail", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_idx" ON "ticketbooking"."WalletTransaction"("userId");

-- CreateIndex
CREATE INDEX "WalletTopupRequest_status_createdAt_idx" ON "ticketbooking"."WalletTopupRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTopupRequest_userEmail_createdAt_idx" ON "ticketbooking"."WalletTopupRequest"("userEmail", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTopupRequest_userId_idx" ON "ticketbooking"."WalletTopupRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reservationId_key" ON "ticketbooking"."Booking"("reservationId");

-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "ticketbooking"."Booking"("userId");

-- CreateIndex
CREATE INDEX "Booking_eventId_idx" ON "ticketbooking"."Booking"("eventId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "ticketbooking"."Booking"("status");

-- AddForeignKey
ALTER TABLE "ticketbooking"."Event" ADD CONSTRAINT "Event_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "ticketbooking"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketbooking"."Seat" ADD CONSTRAINT "Seat_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ticketbooking"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketbooking"."Seat" ADD CONSTRAINT "Seat_reservedBy_fkey" FOREIGN KEY ("reservedBy") REFERENCES "ticketbooking"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketbooking"."Reservation" ADD CONSTRAINT "Reservation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ticketbooking"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketbooking"."Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ticketbooking"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketbooking"."Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ticketbooking"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketbooking"."Booking" ADD CONSTRAINT "Booking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ticketbooking"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketbooking"."Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ticketbooking"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketbooking"."WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ticketbooking"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketbooking"."WalletTopupRequest" ADD CONSTRAINT "WalletTopupRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ticketbooking"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketbooking"."WalletTopupRequest" ADD CONSTRAINT "WalletTopupRequest_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "ticketbooking"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
