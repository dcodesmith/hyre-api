import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { BookingModule } from "../booking/booking.module";
import { CommunicationModule } from "../communication/communication.module";
import { PaymentModule } from "../payment/payment.module";
import { SchedulerService } from "./application/services/scheduler.service";
import { ProcessingProcessor } from "./infrastructure/processors/processing.processor";
import { ReminderProcessor } from "./infrastructure/processors/reminder.processor";
import { StatusUpdateProcessor } from "./infrastructure/processors/status-update.processor";

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
  providers: [SchedulerService, ReminderProcessor, StatusUpdateProcessor, ProcessingProcessor],
  exports: [SchedulerService],
})
export class SchedulingModule {}
