-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('AVAILABLE', 'BOOKED', 'HOLD', 'IN_SERVICE');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED', 'REFUND_PROCESSING', 'REFUND_FAILED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "public"."UserType" AS ENUM ('REGISTERED', 'GUEST');

-- CreateEnum
CREATE TYPE "public"."BookingType" AS ENUM ('DAY', 'NIGHT');

-- CreateEnum
CREATE TYPE "public"."ExtensionEventType" AS ENUM ('HOURLY_ADDITION', 'NEW_DAY_ADDITION');

-- CreateEnum
CREATE TYPE "public"."PaymentAttemptStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'REFUNDED', 'REFUND_PROCESSING', 'REFUND_FAILED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "public"."PayoutTransactionStatus" AS ENUM ('PENDING_APPROVAL', 'PENDING_DISBURSEMENT', 'PROCESSING', 'PAID_OUT', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "public"."CarApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."FleetOwnerStatus" AS ENUM ('PROCESSING', 'APPROVED', 'ON_HOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."ChauffeurApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."DocumentType" AS ENUM ('NIN', 'DRIVERS_LICENSE', 'MOT_CERTIFICATE', 'INSURANCE_CERTIFICATE', 'VEHICLE_IMAGES', 'CERTIFICATE_OF_INCORPORATION');

-- CreateEnum
CREATE TYPE "public"."PlatformFeeType" AS ENUM ('PLATFORM_SERVICE_FEE', 'FLEET_OWNER_COMMISSION');

-- CreateTable
CREATE TABLE "public"."Car" (
    "id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "dayRate" INTEGER NOT NULL,
    "nightRate" INTEGER NOT NULL,
    "hourlyRate" INTEGER NOT NULL,
    "status" "public"."Status" NOT NULL,
    "approvalStatus" "public"."CarApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvalNotes" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "userType" "public"."UserType" NOT NULL DEFAULT 'REGISTERED',
    "email" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "hasOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "guestExpiresAt" TIMESTAMP(3),
    "bankDetailsId" TEXT,
    "fleetOwnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fleetOwnerStatus" "public"."FleetOwnerStatus" DEFAULT 'PROCESSING',
    "chauffeurApprovalStatus" "public"."ChauffeurApprovalStatus" DEFAULT 'PENDING',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Permission" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "access" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Booking" (
    "id" TEXT NOT NULL,
    "bookingReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "type" "public"."BookingType" NOT NULL DEFAULT 'DAY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentId" TEXT,
    "paymentIntent" TEXT,
    "netTotal" DECIMAL(10,2),
    "platformCustomerServiceFeeRatePercent" DECIMAL(5,2),
    "platformCustomerServiceFeeAmount" DECIMAL(10,2),
    "subtotalBeforeVat" DECIMAL(10,2),
    "vatRatePercent" DECIMAL(5,2),
    "vatAmount" DECIMAL(10,2),
    "platformFleetOwnerCommissionRatePercent" DECIMAL(5,2),
    "platformFleetOwnerCommissionAmount" DECIMAL(10,2),
    "fleetOwnerPayoutAmountNet" DECIMAL(10,2),
    "overallPayoutStatus" "public"."PayoutTransactionStatus",
    "carId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "dropOffAddress" TEXT NOT NULL,
    "specialRequests" TEXT,
    "chauffeurId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingLeg" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "legDate" DATE NOT NULL,
    "legStartTime" TIMESTAMP(3) NOT NULL,
    "legEndTime" TIMESTAMP(3) NOT NULL,
    "itemsNetValueForLeg" DECIMAL(10,2) NOT NULL,
    "platformCommissionRateOnLeg" DECIMAL(5,2),
    "platformCommissionAmountOnLeg" DECIMAL(10,2),
    "fleetOwnerEarningForLeg" DECIMAL(10,2) NOT NULL,
    "totalDailyPrice" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Extension" (
    "id" TEXT NOT NULL,
    "eventType" "public"."ExtensionEventType" NOT NULL,
    "bookingLegId" TEXT NOT NULL,
    "extensionStartTime" TIMESTAMP(3) NOT NULL,
    "extensionEndTime" TIMESTAMP(3) NOT NULL,
    "extendedDurationHours" INTEGER NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentId" TEXT,
    "paymentIntent" TEXT,
    "netTotal" DECIMAL(10,2),
    "platformCustomerServiceFeeRatePercent" DECIMAL(5,2),
    "platformCustomerServiceFeeAmount" DECIMAL(10,2),
    "subtotalBeforeVat" DECIMAL(10,2),
    "vatRatePercent" DECIMAL(5,2),
    "vatAmount" DECIMAL(10,2),
    "platformFleetOwnerCommissionRatePercent" DECIMAL(5,2),
    "platformFleetOwnerCommissionAmount" DECIMAL(10,2),
    "fleetOwnerPayoutAmountNet" DECIMAL(10,2),
    "overallPayoutStatus" "public"."PayoutTransactionStatus",
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Extension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "extensionId" TEXT,
    "txRef" TEXT NOT NULL,
    "flutterwaveTransactionId" TEXT,
    "flutterwaveReference" TEXT,
    "amountExpected" DECIMAL(10,2) NOT NULL,
    "amountCharged" DECIMAL(10,2),
    "currency" TEXT NOT NULL,
    "feeChargedByProvider" DECIMAL(10,2),
    "status" "public"."PaymentAttemptStatus" NOT NULL,
    "paymentProviderStatus" TEXT,
    "paymentMethod" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "webhookPayload" JSONB,
    "verificationResponse" JSONB,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayoutTransaction" (
    "id" TEXT NOT NULL,
    "fleetOwnerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "extensionId" TEXT,
    "amountToPay" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2),
    "currency" TEXT NOT NULL,
    "status" "public"."PayoutTransactionStatus" NOT NULL,
    "payoutProviderReference" TEXT,
    "payoutMethodDetails" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "PayoutTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DocumentApproval" (
    "id" TEXT NOT NULL,
    "documentType" "public"."DocumentType" NOT NULL,
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "documentUrl" TEXT NOT NULL,
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "userId" TEXT,
    "carId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VehicleImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "carId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxRate" (
    "id" TEXT NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "effectiveSince" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "description" TEXT DEFAULT 'Nigerian VAT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlatformFeeRate" (
    "id" TEXT NOT NULL,
    "feeType" "public"."PlatformFeeType" NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "effectiveSince" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BankDetails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "verificationResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_RoleToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoleToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_PermissionToRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PermissionToRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Car_ownerId_idx" ON "public"."Car"("ownerId");

-- CreateIndex
CREATE INDEX "Car_ownerId_updatedAt_idx" ON "public"."Car"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "Car_ownerId_approvalStatus_idx" ON "public"."Car"("ownerId", "approvalStatus");

-- CreateIndex
CREATE INDEX "Car_approvalStatus_idx" ON "public"."Car"("approvalStatus");

-- CreateIndex
CREATE INDEX "Car_status_idx" ON "public"."Car"("status");

-- CreateIndex
CREATE INDEX "Car_updatedAt_dayRate_idx" ON "public"."Car"("updatedAt" DESC, "dayRate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE INDEX "User_fleetOwnerId_idx" ON "public"."User"("fleetOwnerId");

-- CreateIndex
CREATE INDEX "User_fleetOwnerStatus_hasOnboarded_idx" ON "public"."User"("fleetOwnerStatus", "hasOnboarded");

-- CreateIndex
CREATE INDEX "User_hasOnboarded_idx" ON "public"."User"("hasOnboarded");

-- CreateIndex
CREATE INDEX "User_id_email_idx" ON "public"."User"("id", "email");

-- CreateIndex
CREATE INDEX "User_userType_idx" ON "public"."User"("userType");

-- CreateIndex
CREATE INDEX "User_userType_guestExpiresAt_idx" ON "public"."User"("userType", "guestExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "public"."Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_action_entity_access_key" ON "public"."Permission"("action", "entity", "access");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingReference_key" ON "public"."Booking"("bookingReference");

-- CreateIndex
CREATE INDEX "Booking_bookingReference_idx" ON "public"."Booking"("bookingReference");

-- CreateIndex
CREATE INDEX "Booking_carId_idx" ON "public"."Booking"("carId");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "public"."Booking"("customerId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "public"."Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_chauffeurId_idx" ON "public"."Booking"("chauffeurId");

-- CreateIndex
CREATE INDEX "Booking_paymentStatus_idx" ON "public"."Booking"("paymentStatus");

-- CreateIndex
CREATE INDEX "Booking_paymentIntent_idx" ON "public"."Booking"("paymentIntent");

-- CreateIndex
CREATE INDEX "Booking_overallPayoutStatus_idx" ON "public"."Booking"("overallPayoutStatus");

-- CreateIndex
CREATE INDEX "Booking_startDate_endDate_status_idx" ON "public"."Booking"("startDate", "endDate", "status");

-- CreateIndex
CREATE INDEX "Booking_chauffeurId_status_startDate_endDate_idx" ON "public"."Booking"("chauffeurId", "status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Booking_carId_paymentStatus_status_startDate_endDate_idx" ON "public"."Booking"("carId", "paymentStatus", "status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Booking_type_endDate_idx" ON "public"."Booking"("type", "endDate");

-- CreateIndex
CREATE INDEX "BookingLeg_bookingId_idx" ON "public"."BookingLeg"("bookingId");

-- CreateIndex
CREATE INDEX "BookingLeg_legDate_idx" ON "public"."BookingLeg"("legDate");

-- CreateIndex
CREATE UNIQUE INDEX "BookingLeg_bookingId_legDate_key" ON "public"."BookingLeg"("bookingId", "legDate");

-- CreateIndex
CREATE INDEX "Extension_bookingLegId_idx" ON "public"."Extension"("bookingLegId");

-- CreateIndex
CREATE INDEX "Extension_paymentStatus_idx" ON "public"."Extension"("paymentStatus");

-- CreateIndex
CREATE INDEX "Extension_eventType_idx" ON "public"."Extension"("eventType");

-- CreateIndex
CREATE INDEX "Extension_status_idx" ON "public"."Extension"("status");

-- CreateIndex
CREATE INDEX "Extension_overallPayoutStatus_idx" ON "public"."Extension"("overallPayoutStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_txRef_key" ON "public"."Payment"("txRef");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_flutterwaveTransactionId_key" ON "public"."Payment"("flutterwaveTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_flutterwaveReference_key" ON "public"."Payment"("flutterwaveReference");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "public"."Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_extensionId_idx" ON "public"."Payment"("extensionId");

-- CreateIndex
CREATE INDEX "Payment_txRef_idx" ON "public"."Payment"("txRef");

-- CreateIndex
CREATE INDEX "Payment_flutterwaveTransactionId_idx" ON "public"."Payment"("flutterwaveTransactionId");

-- CreateIndex
CREATE INDEX "Payment_flutterwaveReference_idx" ON "public"."Payment"("flutterwaveReference");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "public"."Payment"("status");

-- CreateIndex
CREATE INDEX "PayoutTransaction_fleetOwnerId_idx" ON "public"."PayoutTransaction"("fleetOwnerId");

-- CreateIndex
CREATE INDEX "PayoutTransaction_status_idx" ON "public"."PayoutTransaction"("status");

-- CreateIndex
CREATE INDEX "PayoutTransaction_bookingId_idx" ON "public"."PayoutTransaction"("bookingId");

-- CreateIndex
CREATE INDEX "PayoutTransaction_extensionId_idx" ON "public"."PayoutTransaction"("extensionId");

-- CreateIndex
CREATE INDEX "DocumentApproval_status_idx" ON "public"."DocumentApproval"("status");

-- CreateIndex
CREATE INDEX "DocumentApproval_documentType_idx" ON "public"."DocumentApproval"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentApproval_documentType_userId_key" ON "public"."DocumentApproval"("documentType", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentApproval_documentType_carId_key" ON "public"."DocumentApproval"("documentType", "carId");

-- CreateIndex
CREATE INDEX "VehicleImage_carId_idx" ON "public"."VehicleImage"("carId");

-- CreateIndex
CREATE INDEX "VehicleImage_status_idx" ON "public"."VehicleImage"("status");

-- CreateIndex
CREATE INDEX "TaxRate_effectiveSince_effectiveUntil_idx" ON "public"."TaxRate"("effectiveSince", "effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_effectiveSince_key" ON "public"."TaxRate"("effectiveSince");

-- CreateIndex
CREATE INDEX "PlatformFeeRate_feeType_effectiveSince_effectiveUntil_idx" ON "public"."PlatformFeeRate"("feeType", "effectiveSince", "effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFeeRate_feeType_effectiveSince_key" ON "public"."PlatformFeeRate"("feeType", "effectiveSince");

-- CreateIndex
CREATE UNIQUE INDEX "BankDetails_userId_key" ON "public"."BankDetails"("userId");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "public"."_RoleToUser"("B");

-- CreateIndex
CREATE INDEX "_PermissionToRole_B_index" ON "public"."_PermissionToRole"("B");

-- AddForeignKey
ALTER TABLE "public"."Car" ADD CONSTRAINT "Car_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_fleetOwnerId_fkey" FOREIGN KEY ("fleetOwnerId") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_carId_fkey" FOREIGN KEY ("carId") REFERENCES "public"."Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_chauffeurId_fkey" FOREIGN KEY ("chauffeurId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingLeg" ADD CONSTRAINT "BookingLeg_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Extension" ADD CONSTRAINT "Extension_bookingLegId_fkey" FOREIGN KEY ("bookingLegId") REFERENCES "public"."BookingLeg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "public"."Extension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_fleetOwnerId_fkey" FOREIGN KEY ("fleetOwnerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "public"."Extension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentApproval" ADD CONSTRAINT "DocumentApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentApproval" ADD CONSTRAINT "DocumentApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentApproval" ADD CONSTRAINT "DocumentApproval_carId_fkey" FOREIGN KEY ("carId") REFERENCES "public"."Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VehicleImage" ADD CONSTRAINT "VehicleImage_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VehicleImage" ADD CONSTRAINT "VehicleImage_carId_fkey" FOREIGN KEY ("carId") REFERENCES "public"."Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankDetails" ADD CONSTRAINT "BankDetails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
