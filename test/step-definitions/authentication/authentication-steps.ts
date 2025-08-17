import { expect } from "chai";
import { binding, given, then, when } from "cucumber-tsflow";
import * as jwt from "jsonwebtoken";
import { Steps } from "test/support/steps";
import { CustomWorld } from "../../support/world";

@binding([CustomWorld])
class AuthenticationSteps extends Steps {
  constructor(world: CustomWorld) {
    super(world);
  }

  private accessToken: string = "";

  @when(/^I authenticate with email "([^"]*)" as "([^"]*)"$/)
  public async whenIAuthenticateWithEmailAndRole(email: string, role: string) {
    this.accessToken = await this.authenticationService.authenticate(email, role);
  }

  // step that accepts email and role
  @when(/^I register with email "([^"]*)" as "([^"]*)"$/)
  public async whenIRegisterWithEmailAndRole(email: string, role: string) {
    this.accessToken = await this.authenticationService.authenticate(email, role);
  }

  @then(/^I should receive a valid access token for user "([^"]*)"$/)
  public thenIShouldReceiveAValidAccessToken(email: string) {
    const jwtPayload = jwt.verify(this.accessToken, process.env.JWT_SECRET) as jwt.JwtPayload;

    expect(jwtPayload).to.have.property("email");
    expect(jwtPayload).to.have.property("roles");
    expect(jwtPayload).to.have.property("iat");
    expect(jwtPayload).to.have.property("exp");
    expect(jwtPayload.email).to.equal(email);
    expect(jwtPayload.roles).to.be.instanceOf(Array);

    const currentTime = Math.floor(Date.now() / 1000);
    expect(jwtPayload.exp).to.be.greaterThan(currentTime);
  }

  @then(/^an OTP email should be sent to "([^"]*)"$/)
  public async thenOtpEmailShouldBeSent(email: string) {
    const actualOtp = await this.authenticationService.getOtp(email);
    const otpNotifications = this.mockNotificationService.getOtpNotifications();
    const emailNotification = otpNotifications.find((n) => n.getRecipient().email === email);

    const { subject, body } = emailNotification.getContent();

    expect(subject).to.equal("Welcome to Hyre! Complete your registration");
    expect(body).to.contains(`Verification Code: ${actualOtp}`);
  }

  // Helper step to clear mock notifications between scenarios
  @given(/^the notification mock is cleared$/)
  public givenNotificationMockIsCleared() {
    this.mockNotificationService.clear();
  }

  @when("I logout")
  public async whenILogout() {
    await this.authenticationService.logout();
  }

  @then(/^I should not be able to access the user profile$/)
  public async thenIShouldNotBeAbleToAccessTheUserProfile() {
    const response = await this.apiClient.get("/users/me");

    expect(response.status).to.equal(401);
    expect(response.data.message).to.equal("Access token required");
  }

  @then(/^I should be able to access the user profile$/)
  public async thenIShouldBeAbleToAccessTheUserProfile() {
    const response = await this.apiClient.get("/users/me");

    expect(response.status).to.equal(200);
    expect(response.data.message).to.equal("User profile retrieved successfully");
  }
}

export = AuthenticationSteps;
