import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { PaymentVerificationRequestedHandler } from "./application/event-handlers/payment-verification-requested.handler";
import { PayoutCompletedHandler } from "./application/event-handlers/payout-completed.handler";
import { PayoutFailedHandler } from "./application/event-handlers/payout-failed.handler";
import { PayoutService } from "./application/services/payout.service";
import { WebhookService } from "./application/services/webhook.service";
import { PayoutRepository } from "./domain/repositories/payout.repository";
import { PaymentGateway } from "./domain/services/payment-gateway.interface";
import { PayoutPolicyService } from "./domain/services/payout-policy.service";
import { FlutterwavePaymentGateway } from "./infrastructure/gateways/flutterwave-payment.gateway";
import { PrismaPayoutRepository } from "./infrastructure/repositories/prisma-payout.repository";
import { WebhookController } from "./presentation/webhook.controller";

const applicationServices = [PayoutService, WebhookService];
const domainServices = [PayoutPolicyService];
const repositories = [
  {
    provide: PayoutRepository,
    useClass: PrismaPayoutRepository,
  },
];
const gateways = [
  {
    provide: PaymentGateway,
    useClass: FlutterwavePaymentGateway,
  },
];
const eventHandlers = [
  PayoutCompletedHandler,
  PayoutFailedHandler,
  PaymentVerificationRequestedHandler,
];

@Module({
  controllers: [WebhookController],
  imports: [CqrsModule],
  providers: [
    ...applicationServices,
    ...domainServices,
    ...repositories,
    ...gateways,
    ...eventHandlers,
  ],
  exports: [PayoutService, PayoutRepository, PaymentGateway, WebhookService],
})
export class PaymentModule {}
