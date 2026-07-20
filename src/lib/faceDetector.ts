import * as faceapi from "@vladmandic/face-api";

let modelsLoaded = false;
const MODEL_URLS = [
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/",
  "https://unpkg.com/@vladmandic/face-api/model/",
  "https://cdn.jsdelivr.net/gh/vladmandic/face-api@master/model/",
  "https://raw.githubusercontent.com/vladmandic/face-api/master/model/"
];

export async function loadFaceApiModels() {
  if (modelsLoaded) return true;

  let lastError = null;
  for (const url of MODEL_URLS) {
    try {
      console.log(`Mencoba memuat model FaceAPI dari: ${url}`);
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(url),
        faceapi.nets.faceLandmark68Net.loadFromUri(url),
        faceapi.nets.faceRecognitionNet.loadFromUri(url),
      ]);
      modelsLoaded = true;
      console.log(`Model FaceAPI berhasil dimuat dari: ${url}`);
      return true;
    } catch (err) {
      console.warn(`Gagal memuat model dari ${url}, mencoba CDN berikutnya...`, err);
      lastError = err;
    }
  }

  console.error("Semua CDN model FaceAPI gagal dimuat.", lastError);
  throw new Error("Gagal mengunduh model pengenalan wajah dari CDN. Periksa koneksi internet Anda.");
}

// Compare two 128-dimensional embedding vectors (Euclidean distance)
export function getFaceDistance(descriptor1: number[], descriptor2: number[]): number {
  if (descriptor1.length !== descriptor2.length) return 1.0;
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Helper to check liveness & expression hints
export function detectExpressionScore(landmarks: any): {
  smileScore: number;
  blinkScore: number;
  mouthOpen: boolean;
} {
  // landmarks.getLeftEye() has points 36-41, rightEye 42-47, mouth 48-67
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const mouth = landmarks.getMouth();

  // Simple eye blink score (ratio of height to width)
  const calculateEyeAspectRatio = (eyePoints: any[]) => {
    const p1 = eyePoints[0];
    const p2 = eyePoints[1];
    const p3 = eyePoints[2];
    const p4 = eyePoints[3];
    const p5 = eyePoints[4];
    const p6 = eyePoints[5];

    const width = Math.hypot(p1.x - p4.x, p1.y - p4.y);
    const height1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
    const height2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
    return (height1 + height2) / (2 * width);
  };

  const leftEAR = calculateEyeAspectRatio(leftEye);
  const rightEAR = calculateEyeAspectRatio(rightEye);
  const avgEAR = (leftEAR + rightEAR) / 2;

  // Simple mouth smile calculation (width of lip vs distance to nose/chin)
  const mouthLeft = mouth[0];
  const mouthRight = mouth[6];
  const mouthTop = mouth[3];
  const mouthBottom = mouth[9];

  const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
  const mouthHeight = Math.hypot(mouthTop.x - mouthBottom.x, mouthTop.y - mouthBottom.y);

  const mouthOpen = mouthHeight / mouthWidth > 0.35;

  return {
    smileScore: mouthWidth / 100, // Normalized
    blinkScore: avgEAR,
    mouthOpen,
  };
}
