import * as fs from "node:fs";
import * as path from "node:path";

const FIXTURES_PATH = path.join(__dirname, "..", "fixtures");

export function getCarImage(): Buffer {
  return fs.readFileSync(path.join(FIXTURES_PATH, "test-car-image.jpg"));
}

export function getDocument(): Buffer {
  return fs.readFileSync(path.join(FIXTURES_PATH, "test-document.pdf"));
}

export function getCertificate(): Buffer {
  return fs.readFileSync(path.join(FIXTURES_PATH, "test-certificate.pdf"));
}

export function createFormDataWithCarFiles(carData: any): FormData {
  const formData = new FormData();

  // Add car data fields

  for (const [key, value] of Object.entries(carData)) {
    if (
      key !== "images" &&
      key !== "motCertificate" &&
      key !== "insurance" &&
      key !== "insuranceCertificate"
    ) {
      formData.append(key, value as string);
    }
  }

  // Add car images (multiple files)
  if (carData.images) {
    const imageBuffer = getCarImage();
    const imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" });
    for (let i = 0; i < carData.images; i++) {
      formData.append("images", imageBlob, `test-car-${i + 1}.jpg`);
    }
  }

  // Add MOT certificate
  if (carData.motCertificate) {
    const docBuffer = getDocument();
    const docBlob = new Blob([new Uint8Array(docBuffer)], { type: "application/pdf" });
    formData.append("motCertificate", docBlob, "test-mot.pdf");
  }

  // Add insurance document
  if (carData.insurance || carData.insuranceCertificate) {
    const docBuffer = getDocument();
    const docBlob = new Blob([new Uint8Array(docBuffer)], { type: "application/pdf" });
    formData.append("insuranceCertificate", docBlob, "test-insurance.pdf");
  }

  return formData;
}

export function createFormDataWithOnboardingFiles(onboardingData: any): FormData {
  const formData = new FormData();

  // Add onboarding data fields
  for (const [key, value] of Object.entries(onboardingData)) {
    if (key !== "certificateOfIncorporation") {
      formData.append(key, value as string);
    }
  }

  // Add certificate of incorporation
  if (onboardingData.certificateOfIncorporation) {
    const certBuffer = getCertificate();
    const certBlob = new Blob([new Uint8Array(certBuffer)], { type: "application/pdf" });
    formData.append("certificateOfIncorporation", certBlob, "test-certificate.pdf");
  }

  return formData;
}
