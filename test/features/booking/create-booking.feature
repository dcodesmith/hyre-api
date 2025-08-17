# @skip @api @booking
# Feature: Booking Creation
#   As a customer
#   I want to create bookings for chauffeur services
#   So that I can reserve transportation

  Background:
    Given an "customer" user "customer"
    And I am authenticated as user "customer"
    And a fleet owner "fleet-owner" has uploaded a car with registration "car"
    # And a car is available with id "car-456"
    # And current date is "2025-08-10"

#   @smoke
#   Scenario: Successfully create a booking
#     Given I am authenticated as customer "customer-123"
#     # When I create a booking with the following details:
#     #   | customerId      | customer-123            |
#     #   | carId           | car-456                 |
#     #   | startDate       | 2025-08-15T09:00:00Z    |
#     #   | endDate         | 2025-08-15T17:00:00Z    |
#     #   | pickupLocation  | 123 Main St, London     |
#     #   | returnLocation  | 456 Office Ave, London  |
#     #   | bookingType     | hourly                  |
#     # Then the response status should be 201
#     # And the response should contain a booking id
#     # And the booking should have status "pending"
#     # And the booking should have the correct cost calculation

#   @validation @skip
#   Scenario Outline: Booking creation validation
#     Given I am authenticated as customer "customer-123"
#     When I create a booking with invalid data:
#       | field   | value           |
#       | <field> | <invalid_value> |
#     Then the response status should be 400
#     And the error message should contain "<error_message>"

#     Examples:
#       | field           | invalid_value         | error_message          |
#       | customerId      |                       | customerId is required |
#       | carId           | invalid-uuid          | Invalid uuid           |
#       | startDate       | invalid-date          | Invalid datetime       |
#       | endDate         | 2025-08-01T09:00:00Z  | must be in the future  |
#       | pickupLocation  |                       | Address is required    |

#   @business-rules @skip
#   Scenario: Cannot create booking for past dates
#     Given I am authenticated as customer "customer-123"
#     When I create a booking with start date "2025-08-01T09:00:00Z"
#     Then the response status should be 400
#     And the error message should contain "Booking time must be in the future"

#   @business-rules @skip
#   Scenario: Cannot create booking when car is not available
#     Given I am authenticated as customer "customer-123"
#     And car "car-456" is not available on "2025-08-15"
#     When I create a booking for car "car-456" on "2025-08-15"
#     Then the response status should be 409
#     And the error message should contain "Car not available"