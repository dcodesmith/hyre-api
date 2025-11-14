import { ConfigService } from "@nestjs/config";

export class TestConfigService extends ConfigService {
  private readonly overrides: Record<string, unknown> = {
    AUTH_OTP_EXPIRY_MINUTES: 0.005, // 0.3 seconds
  };

  override get<T = unknown>(propertyPath: string, defaultValue?: T): T {
    if (propertyPath in this.overrides) {
      return this.overrides[propertyPath] as T;
    }
    return super.get<T>(propertyPath, defaultValue);
  }
}
