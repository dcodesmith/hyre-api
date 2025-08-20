@skip @api @booking @skip
Feature: Booking Lifecycle Management
  As a system
  I want to manage booking state transitions
  So that bookings progress through their lifecycle correctly

  Background:
    Given a booking exists with id "booking-123" in "confirmed" status
    And the booking has a valid payment

  @state-transition
  Scenario: Activate confirmed booking with payment
    When I activate booking "booking-123" with payment "payment-456"
    Then the response status should be 200
    And the booking status should be "active"
    And the booking should have payment id "payment-456"

  @state-transition
  Scenario: Complete active booking
    Given booking "booking-123" is in "active" status
    And the booking end time has passed
    When I complete booking "booking-123"
    Then the response status should be 200
    And the booking status should be "completed"

  @cancellation
  Scenario: Cancel booking within cancellation period
    Given booking "booking-123" is in "confirmed" status
    And the booking starts in 48 hours
    When I cancel booking "booking-123" with reason "Change of plans"
    Then the response status should be 200
    And the booking status should be "cancelled"
    And a refund should be initiated

  @cancellation
  Scenario: Cannot cancel booking within 24 hours
    Given booking "booking-123" is in "confirmed" status
    And the booking starts in 12 hours
    When I cancel booking "booking-123" with reason "Emergency"
    Then the response status should be 400
    And the error message should contain "Cannot cancel within 24 hours"