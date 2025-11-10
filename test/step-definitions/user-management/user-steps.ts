import { DataTable } from "@cucumber/cucumber";
import { expect } from "chai";
import { binding, given, then, when } from "cucumber-tsflow";
import { Steps } from "../../support/steps";
import { RoleType } from "../../support/support.interface";
import { CustomWorld } from "../../support/world";
import { UserSchema } from "./user-steps.interface";

@binding([CustomWorld])
class UserSteps extends Steps {
  constructor(world: CustomWorld) {
    super(world);
  }

  @given(/^an? "([^"]*)" user "([^"]*)"$/)
  public async givenUserWithRole(roleType: RoleType, userKey: string) {
    await this.databaseHelper.createUser(userKey, roleType);
  }

  @given(/^I am authenticated as user "([^"]*)"$/)
  public async givenAuthenticatedUser(userKey: string) {
    const { email } = this.user.getOrFail(userKey);
    await this.authenticationService.authenticate(email);
  }

  @when(/^"([^"]*)" adds a staff member with the following details$/)
  public async whenIAddStaffMember(userKey: string, dataTable: DataTable) {
    const [hash] = dataTable.hashes();
    const userData = UserSchema.parse(hash);
    const creator = this.user.getOrFail(userKey);

    const response = await this.apiClient.post(`/users/admins/${creator.id}/staff`, {
      email: userData.email,
      name: userData.name,
      phoneNumber: "08012345678", // Test phone number
      role: userData.role,
    });

    this.lastResponse = {
      status: response.status,
      data: response.data,
    };
  }

  @then(/^the response status should be (\d+)$/)
  public thenResponseStatusShouldBe(expectedStatus: string) {
    expect(this.lastResponse.status).to.equal(parseInt(expectedStatus));
  }

  @then(/^staff "([^"]*)" should be created with email "([^"]*)"$/)
  public async thenStaffShouldBeCreatedWithEmail(name: string, email: string) {
    const userId = this.lastResponse.data.userId;
    const response = await this.apiClient.get(`/users/${userId}`);

    expect(response.data.email).to.equal(email);
    expect(response.data.name).to.equal(name);
  }

  @then(/^should error with "([^"]*)"$/)
  public thenShouldErrorWith(error: string) {
    expect(this.lastResponse.data.message).to.equal(error);
  }
}

export = UserSteps;
