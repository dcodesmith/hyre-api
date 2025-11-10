@fleet @upload-car
Feature: Upload a car to a fleet
  As a fleet owner
  I want to upload a car to my fleet
  So that I can rent it out to customers

  Scenario: Upload a car to a fleet
    Given an "fleetOwner" user "fleetOwner"
    And I am authenticated as user "fleetOwner"
    When I upload a car with the following details
      | make   | model | year | color | registrationNumber | dayRate | nightRate | hourlyRate |
      | Toyota | Camry | 2022 | Black | ABC123XX           | 150.00  | 120.00    | 25.00      |
    Then the car should be uploaded successfully
    And the car should be pending approval
