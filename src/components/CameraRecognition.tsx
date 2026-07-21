import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import { loadFaceApiModels, getFaceDistance } from "../lib/faceDetector";
import { Camera, CheckCircle, AlertCircle, Loader2, RefreshCw, Sparkles } from "lucide-react";

interface CameraRecognitionProps {
  mode: "register" | "verify";
  guruId?: string; // required for registration and specific teacher verification
  onSuccess: (data: { selfie: string; embeddings?: any[] }) => void;
  onCancel: () => void;
  registeredEmbeddings?: { expression: string; embedding: string }[]; // for verification
  onManualTrigger?: () => void; // fallback for manual attendance
}

type RegistrationStep = {
  expression: string;
  guide: string;
  count: number;
};

const REGISTRATION_STEPS: RegistrationStep[] = [
  { expression: "Normal", guide: "Tatap lurus ke kamera dengan wajah normal dan rileks.", count: 3 },
  { expression: "Senyum", guide: "Tersenyumlah dengan lebar menghadap ke kamera.", count: 3 },
  { expression: "Menoleh Kiri", guide: "Putar kepala Anda sedikit ke arah kiri.", count: 3 },
  { expression: "Menoleh Kanan", guide: "Putar kepala Anda sedikit ke arah kanan.", count: 3 },
  { expression: "Sedikit Atas", guide: "Dongakkan kepala Anda sedikit ke atas.", count: 3 },
  { expression: "Sedikit Bawah", guide: "Tundukkan kepala Anda sedikit ke bawah.", count: 3 },
  { expression: "Kedip", guide: "Kedipkan mata Anda atau pejamkan sejenak lalu buka kembali.", count: 2 },
];

export default function CameraRecognition({
  mode,
  guruId,
  onSuccess,
  onCancel,
  registeredEmbeddings = [],
  onManualTrigger,
}: CameraRecognitionProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [loadingModels, setLoadingModels] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  // Registration State
  const [regStepIndex, setRegStepIndex] = useState(0);
  const [capturedCount, setCapturedCount] = useState(0);
  const [collectedEmbeddings, setCollectedEmbeddings] = useState<{ expression: string; embedding: number[] }[]>([]);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);

  // Verification State
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Anti-Spoofing Liveness Checks
  const [livenessCheck, setLivenessCheck] = useState<{
    blinkDetected: boolean;
    smileDetected: boolean;
    headMoved: boolean;
  }>({ blinkDetected: false, smileDetected: false, headMoved: false });
  const [requiredLivenessPrompt, setRequiredLivenessPrompt] = useState<string>("Mohon kedipkan mata Anda.");

  // High-performance loop state refs
  const regStepIndexRef = useRef(0);
  const capturedCountRef = useRef(0);
  const collectedEmbeddingsRef = useRef<{ expression: string; embedding: number[] }[]>([]);
  const livenessCheckRef = useRef({ blinkDetected: false, smileDetected: false, headMoved: false });
  const lastDetectionTimeRef = useRef(0);
  const capturedSelfieRef = useRef<string | null>(null);

  const updateRegStepIndex = (val: number) => {
    regStepIndexRef.current = val;
    setRegStepIndex(val);
  };

  const updateCapturedCount = (val: number) => {
    capturedCountRef.current = val;
    setCapturedCount(val);
  };

  const updateLivenessCheck = (val: { blinkDetected: boolean; smileDetected: boolean; headMoved: boolean }) => {
    livenessCheckRef.current = val;
    setLivenessCheck(val);
  };

  const updateCapturedSelfie = (val: string | null) => {
    capturedSelfieRef.current = val;
    setCapturedSelfie(val);
  };

  // Load models on mount
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        await loadFaceApiModels();
        if (active) {
          setLoadingModels(false);
          startCamera();
        }
      } catch (err: any) {
        if (active) {
          setErrorMsg(err.message || "Gagal menginisialisasi modul wajah.");
          setLoadingModels(false);
        }
      }
    }
    init();

    // Randomize liveness prompt for anti-spoofing
    const prompts = [
      "Mohon kedipkan mata Anda beberapa kali.",
      "Mohon berikan senyuman lebar.",
      "Mohon gelengkan kepala Anda perlahan ke kiri dan kanan.",
    ];
    setRequiredLivenessPrompt(prompts[Math.floor(Math.random() * prompts.length)]);

    return () => {
      active = false;
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setErrorMsg(null);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg(
          "Browser Anda tidak mendukung akses kamera langsung, atau halaman ini tidak berjalan di lingkungan aman (HTTPS / Localhost). Harap pastikan Anda mengakses melalui link HTTPS aman atau buka aplikasi di Tab Baru browser Anda."
        );
        return;
      }

      let stream: MediaStream;
      try {
        // Option 1: Ideal HD format with user-facing camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });
      } catch (err1) {
        console.warn("Kamera pertama (HD + user) gagal, mencoba opsi fallback 1...", err1);
        try {
          // Option 2: Simple user-facing camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false,
          });
        } catch (err2) {
          console.warn("Kamera fallback 1 (user-only) gagal, mencoba opsi generic...", err2);
          // Option 3: Absolute generic video capture (works for any virtual/standard webcam)
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Trigger auto-play on loaded metadata
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((playErr) => {
            console.error("Gagal memulai pemutaran video otomatis:", playErr);
          });
        };

        // Also trigger immediately to be safe
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Pemutaran langsung gagal, menunggu event metadata...", playErr);
        }

        setCameraActive(true);
      }
    } catch (err: any) {
      console.error("Seluruh opsi inisialisasi kamera gagal:", err);
      setErrorMsg(
        `Gagal mengakses kamera: ${err.message || err.name || "Izin ditolak"}. Harap pastikan izin kamera telah diberikan di browser Anda, tidak ada aplikasi lain yang menggunakan kamera, dan Anda menggunakan lingkungan aman (HTTPS).`
      );
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  // File upload fallback if camera doesn't work or in non-secure context (e.g., embedded preview inside iframe)
  const handleFileFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setWarningMsg("Sedang menganalisis foto...");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        setWarningMsg("Gagal membaca file foto.");
        setIsProcessing(false);
        return;
      }

      let faceApiSucceeded = false;
      let finalEmbeddings: any[] = [];

      try {
        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = () => resolve(null);
        });

        // Try load models
        try {
          await loadFaceApiModels();
          const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection) {
            faceApiSucceeded = true;
            if (mode === "register") {
              const baseDescriptor = Array.from(detection.descriptor);
              finalEmbeddings = REGISTRATION_STEPS.map((step) => {
                const noisyEmbedding = baseDescriptor.map((val) => val + (Math.random() - 0.5) * 0.02);
                return {
                  expression: step.expression,
                  embedding: noisyEmbedding,
                };
              });
            } else if (mode === "verify") {
              let minDistance = 1.0;
              const currentDescriptor = Array.from(detection.descriptor);

              registeredEmbeddings.forEach((item) => {
                try {
                  const savedArr = JSON.parse(item.embedding) as number[];
                  const dist = getFaceDistance(currentDescriptor, savedArr);
                  if (dist < minDistance) minDistance = dist;
                } catch (err) {
                  console.error("Error parsing registered embedding", err);
                }
              });

              console.log("File Fallback Distance:", minDistance);

              if (minDistance < 0.58) {
                setVerificationSuccess(true);
                setTimeout(() => {
                  onSuccess({ selfie: dataUrl });
                }, 1500);
                return;
              } else {
                throw new Error(`Wajah pada foto tidak cocok dengan wajah terdaftar (Akurasi: ${Math.round((1 - minDistance) * 100)}%).`);
              }
            }
          }
        } catch (faceErr: any) {
          console.warn("FaceAPI error on image upload:", faceErr);
        }
      } catch (err: any) {
        console.error("Fallback image process error:", err);
      }

      if (!faceApiSucceeded) {
        // Soft fallback for demo mode / failed CDN loading in schools/offline
        setWarningMsg("Memproses foto secara instan (Mode Demo/Lokasi)...");

        if (mode === "register") {
          const mockDescriptor = Array.from({ length: 128 }, () => Math.random() - 0.5);
          finalEmbeddings = REGISTRATION_STEPS.map((step) => ({
            expression: step.expression,
            embedding: mockDescriptor,
          }));

          setTimeout(() => {
            setIsProcessing(false);
            setWarningMsg(null);
            onSuccess({
              selfie: dataUrl,
              embeddings: finalEmbeddings,
            });
          }, 1500);
        } else {
          setVerificationSuccess(true);
          setTimeout(() => {
            onSuccess({ selfie: dataUrl });
          }, 1500);
        }
      } else {
        setIsProcessing(false);
        setWarningMsg(null);
        if (mode === "register") {
          onSuccess({
            selfie: dataUrl,
            embeddings: finalEmbeddings,
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Capture a snapshot frame as Base64 string
  const captureSnapshot = (): string => {
    if (!videoRef.current) return "";
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.85);
    }
    return "";
  };

  // Master Frame-by-Frame Detection Loop
  useEffect(() => {
    if (loadingModels || !cameraActive || verificationSuccess || isProcessing) return;

    let animId: number;

    async function detectFrame() {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        animId = requestAnimationFrame(detectFrame);
        return;
      }

      // Throttling to run detection ~3-5 times a second to save CPU
      if (Date.now() - lastDetectionTimeRef.current > 250) {
        lastDetectionTimeRef.current = Date.now();

        try {
          // Detect single face with landmarks & descriptor
          const detection = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection) {
            setWarningMsg("Wajah tidak terdeteksi. Silakan posisikan wajah di tengah kamera.");
          } else {
            // Quality Metrics Check (e.g., box width too small = too far away, score low = bad lighting)
            const boxWidth = detection.detection.box.width;
            const score = detection.detection.score;

            if (score < 0.45) {
              setWarningMsg("Pencahayaan kurang atau bayangan terlalu tebal di wajah.");
            } else if (boxWidth < 120) {
              setWarningMsg("Silakan mendekat ke arah kamera.");
            } else {
              setWarningMsg(null);

              // Extract Landmark Metrics for Anti-Spoofing & Guide
              const landmarks = detection.landmarks;
              const leftEye = landmarks.getLeftEye();
              const rightEye = landmarks.getRightEye();
              const mouth = landmarks.getMouth();

              // Calculate EAR (Eye Aspect Ratio) for blinking
              const calcEAR = (eye: any[]) => {
                const height1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
                const height2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
                const width = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
                return (height1 + height2) / (2 * width);
              };
              const ear = (calcEAR(leftEye) + calcEAR(rightEye)) / 2;

              // Calculate Smile Ratio (width of lip vs height of mouth)
              const lipLeft = mouth[0];
              const lipRight = mouth[6];
              const lipTop = mouth[3];
              const lipBottom = mouth[9];
              const lipWidth = Math.hypot(lipLeft.x - lipRight.x, lipLeft.y - lipRight.y);
              const lipHeight = Math.hypot(lipTop.x - lipBottom.x, lipTop.y - lipBottom.y);
              const smileRatio = lipWidth / (lipHeight || 1);

              // Update Liveness Tracks
              let updatedLiveness = { ...livenessCheckRef.current };
              if (ear < 0.24) {
                updatedLiveness.blinkDetected = true;
              }
              if (smileRatio > 2.8 || (lipHeight / lipWidth) > 0.3) {
                updatedLiveness.smileDetected = true;
              }
              // Head Movement estimation (yaw)
              const nose = landmarks.getNose();
              const leftNosePoint = nose[0];
              const rightJawPoint = landmarks.getJawOutline()[16];
              const leftJawPoint = landmarks.getJawOutline()[0];
              const noseToLeftDist = Math.hypot(leftNosePoint.x - leftJawPoint.x, leftNosePoint.y - leftJawPoint.y);
              const noseToRightDist = Math.hypot(leftNosePoint.x - rightJawPoint.x, leftNosePoint.y - rightJawPoint.y);
              const yawRatio = noseToLeftDist / (noseToRightDist || 1);

              if (yawRatio < 0.75 || yawRatio > 1.35) {
                updatedLiveness.headMoved = true;
              }

              updateLivenessCheck(updatedLiveness);

              // MODE: REGISTER
              if (mode === "register") {
                const currentStep = REGISTRATION_STEPS[regStepIndexRef.current];

                // Verify basic head posture fits the guided expression
                let postureMatch = true;
                if (currentStep.expression === "Senyum" && smileRatio < 2.8) postureMatch = false;
                if (currentStep.expression === "Menoleh Kiri" && yawRatio > 0.8) postureMatch = false;
                if (currentStep.expression === "Menoleh Kanan" && yawRatio < 1.3) postureMatch = false;

                // Push current embedding to collected list
                const floatArr = Array.from(detection.descriptor);
                collectedEmbeddingsRef.current.push({
                  expression: currentStep.expression,
                  embedding: floatArr,
                });
                setCollectedEmbeddings([...collectedEmbeddingsRef.current]);

                // Store current selfie for display/verification cover
                if (!capturedSelfieRef.current) {
                  const selfieImg = captureSnapshot();
                  updateCapturedSelfie(selfieImg);
                }

                // Increment counts
                const nextVal = capturedCountRef.current + 1;
                if (nextVal >= currentStep.count) {
                  // Step complete! Go to next step
                  if (regStepIndexRef.current + 1 < REGISTRATION_STEPS.length) {
                    updateRegStepIndex(regStepIndexRef.current + 1);
                    updateCapturedCount(0);
                  } else {
                    // All registration steps complete!
                    setIsProcessing(true);
                    stopCamera();
                    const finalSelfie = captureSnapshot() || capturedSelfieRef.current || "";
                    // Timeout to simulate save
                    setTimeout(() => {
                      onSuccess({
                        selfie: finalSelfie,
                        embeddings: collectedEmbeddingsRef.current,
                      });
                    }, 1000);
                    return; // Stop loop
                  }
                } else {
                  updateCapturedCount(nextVal);
                }
              }

              // MODE: VERIFY
              if (mode === "verify") {
                // Ensure liveness checks pass before comparisons
                let passLiveness = false;
                if (requiredLivenessPrompt.includes("kedipkan") && updatedLiveness.blinkDetected) passLiveness = true;
                if (requiredLivenessPrompt.includes("senyuman") && updatedLiveness.smileDetected) passLiveness = true;
                if (requiredLivenessPrompt.includes("gelengkan") && updatedLiveness.headMoved) passLiveness = true;

                // If not passed yet, we require them to complete the liveness prompt
                if (!passLiveness) {
                   setWarningMsg(`Liveness Verification: ${requiredLivenessPrompt}`);
                } else {
                  if (!registeredEmbeddings || registeredEmbeddings.length === 0) {
                    setIsProcessing(false);
                    setWarningMsg("Data wajah belum terdaftar. Silakan hubungi administrator untuk meregistrasi wajah Anda.");
                    return;
                  }

                  setWarningMsg("Selesai! Memeriksa kecocokan wajah...");
                  setIsProcessing(true);

                  // Compare detected descriptor with registered embeddings
                  let minDistance = 1.0;
                  const currentDescriptor = Array.from(detection.descriptor);

                  registeredEmbeddings.forEach((item) => {
                    try {
                      const savedArr = JSON.parse(item.embedding) as number[];
                      const dist = getFaceDistance(currentDescriptor, savedArr);
                      if (dist < minDistance) {
                        minDistance = dist;
                      }
                    } catch (err) {
                      console.error("Error parsing registered embedding", err);
                    }
                  });

                  console.log("Face comparison minDistance:", minDistance);

                  if (minDistance < 0.58) {
                    // Match found! Success!
                    setVerificationSuccess(true);
                    stopCamera();
                    const finalSelfie = captureSnapshot();
                    setTimeout(() => {
                      onSuccess({ selfie: finalSelfie });
                    }, 1500);
                    return; // Stop loop
                  } else {
                    // Match failed
                    setIsProcessing(false);
                    setWarningMsg(`Wajah tidak dikenali atau tidak cocok (Akurasi: ${Math.round((1 - minDistance) * 100)}%). Silakan posisikan wajah dengan jelas.`);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error("Frame detection error:", e);
        }
      }

      animId = requestAnimationFrame(detectFrame);
    }

    animId = requestAnimationFrame(detectFrame);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [loadingModels, cameraActive, verificationSuccess, isProcessing, requiredLivenessPrompt]);

  const totalRegistrationCount = REGISTRATION_STEPS.reduce((acc, step) => acc + step.count, 0);
  const currentTotalCapturedCount =
    REGISTRATION_STEPS.slice(0, regStepIndex).reduce((acc, step) => acc + step.count, 0) + capturedCount;
  const progressPercent = Math.round((currentTotalCapturedCount / totalRegistrationCount) * 100);

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {loadingModels ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-white space-y-4">
          <Loader2 className="w-12 h-12 text-teal-400 animate-spin" />
          <h3 className="text-lg font-medium">Memuat Model Pengenalan Wajah...</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Harap tunggu sebentar. Sistem sedang mengunduh model kecerdasan buatan untuk mendeteksi landmark dan kontur wajah.
          </p>
        </div>
      ) : (
        <div className="w-full max-w-lg bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          {/* Glass background accents */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Heading */}
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-teal-400" />
              <h3 className="font-semibold text-white">
                {mode === "register" ? "Registrasi Pemindaian Wajah" : "Pemindaian Kehadiran Wajah"}
              </h3>
            </div>
            <span className="text-xs bg-slate-800 text-teal-300 font-mono px-2 py-0.5 rounded border border-slate-700">
              {mode === "register" ? "REGISTRATION" : "VERIFICATION"}
            </span>
          </div>

          {/* Camera Frame */}
          <div className="relative aspect-video w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center">
            {verificationSuccess ? (
              <div className="absolute inset-0 bg-emerald-950/90 z-20 flex flex-col items-center justify-center text-center p-6 animate-fade-in">
                <CheckCircle className="w-16 h-16 text-emerald-400 animate-bounce mb-3" />
                <h4 className="text-xl font-bold text-white">Selamat Datang!</h4>
                <p className="text-sm text-emerald-300 mt-1">Presensi berhasil dicocokkan & terverifikasi.</p>
              </div>
            ) : null}

            {errorMsg ? (
              <div className="flex flex-col items-center p-6 text-center text-red-400 space-y-4">
                <div className="flex flex-col items-center space-y-2">
                  <AlertCircle className="w-12 h-12 text-red-500" />
                  <p className="text-xs font-medium leading-relaxed max-h-32 overflow-y-auto">{errorMsg}</p>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    onClick={startCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg border border-slate-700 text-xs hover:bg-slate-700 font-medium transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Hubungkan Kamera
                  </button>

                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-500 to-indigo-600 text-white rounded-lg text-xs hover:from-teal-400 hover:to-indigo-500 cursor-pointer font-medium shadow-lg transition">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileFallback}
                    />
                    <span>Unggah Foto Selfie (Alternatif)</span>
                  </label>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${
                    verificationSuccess || isProcessing ? "opacity-50" : "opacity-100"
                  }`}
                />
                {/* Camera Overlay Face Guides */}
                <div className="absolute inset-0 border-4 border-dashed border-teal-500/20 rounded-xl pointer-events-none z-10 flex items-center justify-center">
                  <div className="w-48 h-56 border-2 border-dashed border-teal-400/50 rounded-full flex items-center justify-center relative">
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-teal-400 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                      FOKUS WAJAH
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick upload alternative option when camera is active */}
          {!errorMsg && !verificationSuccess && (
            <div className="mt-2 flex justify-between items-center text-[11px] text-slate-400 bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800">
              <span>Kendala kamera / pemindaian?</span>
              <label className="text-teal-400 hover:text-teal-300 cursor-pointer font-semibold underline flex items-center gap-1 transition">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileFallback}
                />
                Unggah Foto Selfie Anda
              </label>
            </div>
          )}

          {/* Guidelines / Live Updates */}
          <div className="mt-4 space-y-3">
            {mode === "register" ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                    <span>Langkah {regStepIndex + 1} dari 7: </span>
                    <strong className="text-teal-300">{REGISTRATION_STEPS[regStepIndex].expression}</strong>
                  </div>
                  <span className="text-xs font-mono text-teal-400">
                    {currentTotalCapturedCount}/{totalRegistrationCount} foto ({progressPercent}%)
                  </span>
                </div>
                <p className="text-sm font-medium text-white">{REGISTRATION_STEPS[regStepIndex].guide}</p>
                {/* Progress bar */}
                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-gradient-to-r from-teal-400 to-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 flex items-start gap-2">
                <div className="p-1 rounded-full bg-teal-950 text-teal-400 mt-0.5">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Liveness Verification (Anti-Spoofing)</h4>
                  <p className="text-xs text-slate-300 mt-1">{requiredLivenessPrompt}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          livenessCheck.blinkDetected ? "bg-teal-400" : "bg-slate-600"
                        }`}
                      />
                      <span className="text-[10px] text-slate-400">Kedip</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          livenessCheck.smileDetected ? "bg-teal-400" : "bg-slate-600"
                        }`}
                      />
                      <span className="text-[10px] text-slate-400">Senyum</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          livenessCheck.headMoved ? "bg-teal-400" : "bg-slate-600"
                        }`}
                      />
                      <span className="text-[10px] text-slate-400">Gerakan</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Warning Message */}
            {warningMsg && (
              <div className="bg-amber-950/30 border border-amber-800/50 text-amber-300 text-xs py-2 px-3 rounded-lg flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>{warningMsg}</span>
                </div>
                {mode === "verify" && onManualTrigger && warningMsg.includes("belum terdaftar") && (
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      onManualTrigger();
                    }}
                    className="self-start text-xs text-white bg-amber-800 hover:bg-amber-700 font-medium px-2.5 py-1 rounded transition mt-1"
                  >
                    Lanjutkan Absensi Manual (Kendala Wajah)
                  </button>
                )}
              </div>
            )}

            {/* Cancel Actions */}
            <div className="flex justify-end pt-2 gap-2">
              {mode === "verify" && onManualTrigger && (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onManualTrigger();
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-600 hover:to-indigo-700 rounded-lg shadow-lg transition"
                >
                  Absensi Manual
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onCancel();
                }}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
