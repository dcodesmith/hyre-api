@only @api @authentication
Feature: OTP Authentication
  As a user
  I want to authenticate using email OTP
  So that I can access the platform securely

  Background:
    Given the notification mock is cleared

  Scenario: Registration - OTP authentication for new user
    When I register with email "newuser@example.com" as "customer"
    Then an OTP email should be sent to "newuser@example.com"
    And I should be able to access the user profile

  Scenario: Login - OTP authentication for existing user
    When I authenticate with email "existinguser@example.com" as "customer"
    Then an OTP email should be sent to "existinguser@example.com"
    And I should be able to access the user profile

  Scenario: Registration - Fleet owner OTP authentication
    When I register with email "fleetowner@example.com" as "fleetOwner"
    Then an OTP email should be sent to "fleetowner@example.com"
    And I should be able to access the user profile

  Scenario: Secure logout - Token invalidation and session cleanup
    Given I authenticate with email "testuser@example.com" as "customer"
    When I logout
    Then I should not be able to access the user profile

  Scenario: Fleet owner logout - Complete session termination
    Given I register with email "fleetowner.logout@example.com" as "fleetOwner"
    When I logout
    Then I should not be able to access the user profile
