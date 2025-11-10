/**
 * Anti-corruption layer interface for fleet validation
 * Defines what the Booking domain needs to know about fleet operations
 * without depending directly on Fleet domain
 */
export interface CarOwnershipInfo {
  carId: string;
  ownerId: string;
  fleetId: string;
}

export interface FleetValidationService {
  /**
   * Get the owner ID for a given car
   */
  getCarOwnership(carId: string): Promise<CarOwnershipInfo | null>;

  /**
   * Validate that a car belongs to a specific fleet owner
   */
  validateCarOwnership(carId: string, ownerId: string): Promise<boolean>;

  /**
   * Check if a fleet owner has access to assign chauffeurs
   */
  canFleetOwnerAssignChauffeur(fleetOwnerId: string, chauffeurId: string): Promise<boolean>;
}
