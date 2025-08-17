@api @user-management
Feature: Add staff for approvals
  As an admin
  I want to add a staff member to the platform
  So that they can approve fleet owners and cars

  Scenario: Successfully add staff member
    Given an "admin" user "admin"
    And I am authenticated as user "admin"
    When "admin" adds a staff member with the following details
      | name     | email                | role  |
      | John Doe | john.doe@example.com | staff |
    Then staff "John Doe" should be created with email "john.doe@example.com"

  @authorization
  Scenario Outline: Role-based authorization for adding staff
    Given a "<role>" user "<userKey>"
    And I am authenticated as user "<userKey>"
    When "<userKey>" adds a staff member with the following details
      | name      | email                 | role  |
      | New Staff | new.staff@example.com | staff |
    Then should error with "<errorMessage>"

    Examples:
      | role       | userKey    | errorMessage                         |
      | staff      | staff      | Access denied. Required roles: admin |
      | fleetOwner | fleetOwner | Access denied. Required roles: admin |
      | chauffeur  | chauffeur  | Access denied. Required roles: admin |
      | customer   | customer   | Access denied. Required roles: admin |


# booking
#   features
#     booking-management.feature
#   step-definitions
#     booking-management.steps.ts
