import { DataTable } from "@cucumber/cucumber";
import { binding, given, when } from "cucumber-tsflow";
import { Steps } from "../../support/steps";
import { CustomWorld } from "../../support/world";

@binding([CustomWorld])
class BookingSteps extends Steps {
  constructor(world: CustomWorld) {
    super(world);
  }

  @given(/^a valid customer exists with id "([^"]*)"$/)
  public async givenValidCustomer(customerId: string): Promise<void> {
    await this.databaseHelper.createUser(customerId);
  }

  @given(/^a car is available with id "([^"]*)"$/)
  public async givenAvailableCar(_carId: string): Promise<void> {
    // TODO: Fix createCar parameters
    // await this.databaseHelper.createCar({
    //   id: carId,
    //   category: "premium",
    //   dayRate: 400,
    //   hourlyRate: 50,
    //   available: true,
    // });
  }

  @when(/^I make a booking using customer "([^"]*)" and car "([^"]*)" with the following details:$/)
  public async whenIMakeBooking(
    customerKey: string,
    carKey: string,
    dataTable: DataTable,
  ): Promise<void> {
    const [bookingData] = dataTable.hashes();

    const _customer = this.customer.get(customerKey);
    const car = this.car.get(carKey);

    // Updated payload format matching the new API
    const bookingPayload = {
      carId: car.id,
      from: bookingData.from || bookingData.startDate,
      to: bookingData.to || bookingData.endDate,
      pickupTime: bookingData.pickupTime || "8:00 AM",
      pickupAddress: bookingData.pickupAddress || bookingData.pickupLocation,
      dropOffAddress: bookingData.dropOffAddress || bookingData.returnLocation,
      sameLocation: bookingData.sameLocation === "true" || false,
      bookingType: bookingData.bookingType || "DAY",
      includeSecurityDetail: bookingData.includeSecurityDetail === "true" || false,
      specialRequests: bookingData.specialRequests || undefined,
      totalAmount: Number.parseFloat(bookingData.totalAmount || "50000"),
      // Guest user fields (for now, assume all test customers are registered users)
      // TODO: Update when guest user support is added to test helpers
    };

    try {
      this.lastResponse = await this.apiClient.post("/bookings", bookingPayload);
      this.booking.set("lastBooking", this.lastResponse.data);
    } catch (error: any) {
      this.lastError = error;
      this.lastResponse = error.response || { status: 500, data: { message: error.message } };
    }
  }
}

export = BookingSteps;
