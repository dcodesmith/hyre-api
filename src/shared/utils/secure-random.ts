import { randomBytes } from "node:crypto";

const generateSecureRandomId = () =>
  randomBytes(4)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 6)
    .toLowerCase();

export { generateSecureRandomId };
