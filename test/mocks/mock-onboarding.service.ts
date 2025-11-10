export class MockOnboardingApplicationService {
  async submitOnboardingDocuments() {
    return { success: true };
  }

  async approveOnboarding() {
    return { success: true };
  }

  async rejectOnboarding() {
    return { success: true };
  }
}
