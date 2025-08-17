import { DataTable } from "@cucumber/cucumber";
import { expect } from "chai";
import { binding, given, then, when } from "cucumber-tsflow";
import { createFormDataWithCarFiles } from "../../support/file-fixtures";
import { Steps } from "../../support/steps";
import { CustomWorld } from "../../support/world";

@binding([CustomWorld])
class FleetSteps extends Steps {
  constructor(world: CustomWorld) {
    super(world);
  }

  @when(/^I upload a car with the following details$/)
  public async whenUserUploadsCar(dataTable: DataTable): Promise<void> {
    const [hash] = dataTable.hashes();

    // Create form data with mock files for car upload
    const formData = createFormDataWithCarFiles({
      ...hash,
      images: 2, // Number of images to mock
      motCertificate: true,
      insuranceCertificate: true,
    });

    const response = await this.apiClient.postMultipart("/fleet/cars", formData);

    this.lastResponse = {
      status: response.status,
      data: response.data,
    };
  }

  @given(/^a fleet owner "([^"]*)" has uploaded a car with registration "([^"]*)"$/)
  public async givenFleetOwnerHasUploadedCar(userKey: string, carKey: string): Promise<void> {
    const { id: ownerId } = await this.databaseHelper.createUser(userKey, "fleetOwner");
    const car = await this.databaseHelper.createCar(carKey, { ownerId });

    this.lastResponse = {
      status: 200,
      data: car,
    };

    // TODO: Implement car creation in database for preconditions
    // For now, this is a placeholder for future implementation
  }

  @then(/^the car should be uploaded successfully$/)
  public thenCarShouldBeUploadedSuccessfully(): void {
    expect(this.lastResponse.status).to.be.oneOf([200, 201]);
    expect(this.lastResponse.data).to.have.property("success", true);
    expect(this.lastResponse.data.data).to.have.property("carId");
  }

  @then(/^the car should be in "([^"]*)" status$/)
  public thenCarShouldHaveStatus(expectedStatus: string): void {
    expect(this.lastResponse.data).to.have.property("status", expectedStatus);
  }

  @then(/^the car should be pending approval$/)
  public thenCarShouldBePendingApproval(): void {
    expect(this.lastResponse.data.message).to.include("pending approval");
  }
}

export = FleetSteps;
