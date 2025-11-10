export const Role = {
  USER: "user",
  FLEET_OWNER: "fleetOwner",
  CHAUFFEUR: "chauffeur",
  STAFF: "staff",
  ADMIN: "admin",
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];
