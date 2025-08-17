import { MockNotificationService } from "../mocks/mock-notification.service";
import { CustomWorld } from "./world";

export abstract class Steps {
  constructor(protected world?: CustomWorld) {}

  // Get the actual CustomWorld instance
  protected get customWorld(): CustomWorld {
    if (!this.world) {
      throw new Error("World not injected. Ensure CustomWorld is in @binding() decorator.");
    }
    return this.world;
  }

  // Fluent API access for test data caching
  protected get booking() {
    return this.customWorld.cache.booking;
  }

  protected get customer() {
    return this.customWorld.cache.customer;
  }

  protected get car() {
    return this.customWorld.cache.car;
  }

  protected get driver() {
    return this.customWorld.cache.driver;
  }

  protected get payment() {
    return this.customWorld.cache.payment;
  }

  protected get user() {
    return this.customWorld.cache.user;
  }

  // Helper methods for common operations
  protected get apiClient() {
    return this.customWorld.apiClient;
  }

  protected get builder() {
    return this.customWorld.builder;
  }

  protected get authenticationService() {
    return this.customWorld.authenticationService;
  }

  protected get databaseHelper() {
    return this.customWorld.databaseHelper;
  }

  protected get mockNotificationService(): MockNotificationService {
    return this.customWorld.testApp.getMockNotificationService();
  }

  protected get lastResponse() {
    return this.customWorld.lastResponse;
  }

  protected set lastResponse(response: any) {
    this.customWorld.lastResponse = response;
  }

  protected get lastError() {
    return this.customWorld.lastError;
  }

  protected set lastError(error: any) {
    this.customWorld.lastError = error;
  }

  protected clearCache(): void {
    this.customWorld.cache.clear();
  }

  // Common assertion helpers
  protected expectStatus(expectedStatus: number): void {
    expect(this.lastResponse.status).toBe(expectedStatus);
  }

  protected expectResponseProperty(property: string): void {
    expect(this.lastResponse.data).toHaveProperty(property);
  }

  protected expectErrorMessage(message: string): void {
    expect(this.lastResponse.data.message.toLowerCase()).toContain(message.toLowerCase());
  }
}
