-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ticketbooking";

-- CreateEnum
CREATE TYPE "ticketbooking"."BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ticketbooking"."Admin" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticketbooking"."Booking" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventDate" TEXT NOT NULL,
    "eventTime" TEXT NOT NULL,
    "reservationId" TEXT,
    "userId" INTEGER,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "tickets" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "seatNumbers" TEXT[],
    "status" "ticketbooking"."BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "ticketbooking"."Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reservationId_key" ON "ticketbooking"."Booking"("reservationId");