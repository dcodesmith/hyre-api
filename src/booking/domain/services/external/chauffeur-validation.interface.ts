/**
 * Anti-corruption layer interface for chauffeur validation
 * Defines what the Booking domain needs to know about chauffeurs
 * without depending directly on IAM or Fleet domains
 */
export interface ChauffeurDetails {
  id: string;
  name: string;
  fleetOwnerId: string;
  isActive: boolean;
}

export interface ChauffeurValidationService {
  /**
   * Check if a chauffeur exists and is valid
   */
  validateChauffeurExists(chauffeurId: string): Promise<boolean>;

  /**
   * Check if a chauffeur belongs to a specific fleet owner
   */
  validateChauffeurBelongsToFleet(chauffeurId: string, fleetOwnerId: string): Promise<boolean>;

  /**
   * Get basic chauffeur details needed for booking operations
   */
  getChauffeurDetails(chauffeurId: string): Promise<ChauffeurDetails | null>;

  /**
   * Check if chauffeur is available for the given time period
   */
  isChauffeurAvailable(chauffeurId: string, startDate: Date, endDate: Date): Promise<boolean>;
}
