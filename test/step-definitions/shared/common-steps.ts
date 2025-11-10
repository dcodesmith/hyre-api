import { expect } from "chai";
import { binding, given } from "cucumber-tsflow";
import { Steps } from "../../support/steps";
import { CustomWorld } from "../../support/world";

@binding([CustomWorld])
class CommonSteps extends Steps {
  constructor(world: CustomWorld) {
    super(world);
  }

  @given(/^the API is available$/)
  public async givenApiIsAvailable() {
    const response = await this.apiClient.get("/health");
    expect(response.status).to.equal(200);
  }
}

export = CommonSteps;
