import { PrismaService } from "@/shared/database/prisma.service";

/**
 * Resets the relational data used by E2E tests in an order that respects
 * foreign key constraints. Always delete dependent records before parents.
 */
export async function resetE2EDatabase(prisma: PrismaService): Promise<void> {
  await prisma.extension.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.payoutTransaction.deleteMany();
  await prisma.bookingLeg.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.vehicleImage.deleteMany();
  await prisma.documentApproval.deleteMany();
  await prisma.car.deleteMany();
  await prisma.platformFeeRate.deleteMany();
  await prisma.taxRate.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
}


