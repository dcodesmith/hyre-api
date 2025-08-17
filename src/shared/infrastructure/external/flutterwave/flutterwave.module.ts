import { Module } from "@nestjs/common";
import { FlutterwaveClient } from "./flutterwave.client";

@Module({
  providers: [FlutterwaveClient],
  exports: [FlutterwaveClient],
})
export class FlutterwaveModule {}
