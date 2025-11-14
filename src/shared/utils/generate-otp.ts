import { randomInt } from "node:crypto";

const DIGITS = "0123456789";

export const generateOtpCode = (length = 6): string => {
  let code = "";
  for (let i = 0; i < length; i++) {
    const idx = randomInt(0, DIGITS.length);
    code += DIGITS[idx];
  }
  return code;
};
