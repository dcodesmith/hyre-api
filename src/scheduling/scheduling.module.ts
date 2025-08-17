import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { BookingModule } from "../booking/booking.module";
import { PrismaBookingRepository } from "../booking/infrastructure/repositories/prisma-booking.repository";
import { CommunicationModule } from "../communication/communication.module";
import { PaymentModule } from "../payment/payment.module";
import { SchedulerService } from "./application/services/scheduler.service";
import { ProcessingProcessor } from "./infrastructure/processors/processing.processor";
import { ReminderProcessor } from "./infrastructure/processors/reminder.processor";
import { StatusUpdateProcessor } from "./infrastructure/processors/status-update.processor";
import { ReminderProcessingService } from "./infrastructure/services/reminder-processing.service";

@Module({
  imports: [
    BullModule.registerQueue(
      { name: "reminder-emails" },
      { name: "status-updates" },
      { name: "processing-jobs" },
    ),
    BookingModule,
    PaymentModule,
    CommunicationModule,
  ],
  providers: [
    SchedulerService,
    ReminderProcessor,
    StatusUpdateProcessor,
    ProcessingProcessor,
    ReminderProcessingService,
    {
      provide: "BookingRepository",
      useClass: PrismaBookingRepository,
    },
  ],
  exports: [SchedulerService],
})
export class SchedulingModule {}
