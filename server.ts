import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "smart_attendance_guru_super_secret_key_2026";

// Enable CORS for frontend clients (Vercel, GitHub Pages, etc.)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
}));

// Increase payload limits for Base64 facial captures and selfies
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper function to write logs
async function logActivity(userId: string | null, action: string, details: string, ip?: string) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        details,
        ip: ip || "127.0.0.1",
      },
    });
  } catch (err) {
    console.error("Error writing activity log:", err);
  }
}

// Helper to calculate GPS distance in meters (Haversine formula)
function calculateGPSDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

// Helper to get date and time in selected timezone (WIB, WITA, WIT)
async function getSchoolTime() {
  const schedule = await prisma.schedule.findFirst();
  const timezone = schedule?.timezone || "WIT"; // Default to WIT

  let ianaTz = "Asia/Jayapura"; // Default: WIT
  if (timezone === "WIB") ianaTz = "Asia/Jakarta";
  else if (timezone === "WITA") ianaTz = "Asia/Makassar";

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: ianaTz });
  const timeStr = now.toLocaleTimeString("en-GB", { timeZone: ianaTz, hour12: false });
  
  return { date: dateStr, time: timeStr, timezone };
}

// Database Seeding Routine
async function seedDatabase() {
  try {
    // 1. Seed School Settings
    const schoolCount = await prisma.school.count();
    if (schoolCount === 0) {
      await prisma.school.create({
        data: {
          name: "SMK Negeri 1 Jakarta",
          address: "Jl. Budi Utomo No.7, Sawah Besar, Jakarta Pusat, DKI Jakarta",
          logo: null,
        },
      });
      console.log(" seeded default school profile");
    }

    // 2. Seed Default Location
    const locationCount = await prisma.location.count();
    if (locationCount === 0) {
      await prisma.location.create({
        data: {
          name: "Kampus Utama SMK Negeri 1 Jakarta",
          latitude: -6.168582, // SMKN 1 Jakarta coordinates approx
          longitude: 106.834044,
          radius: 100.0, // 100 meters
        },
      });
      console.log(" seeded default school location with 100m radius");
    }

    // 3. Seed Default Work Schedule
    const scheduleCount = await prisma.schedule.count();
    if (scheduleCount === 0) {
      await prisma.schedule.create({
        data: {
          name: "Jadwal Kerja Standard Guru",
          jamMasuk: "07:00",
          jamPulang: "14:30",
          hariKerja: "Senin,Selasa,Rabu,Kamis,Jumat",
          jamToleransi: 15, // 15 minutes
        },
      });
      console.log(" seeded default work schedule");
    }

    // 4. Seed/Verify Default Admin User based on Metadata
    const hashedAdminPassword = await bcrypt.hash("admin123", 10);
    const existingAdmin = await prisma.user.findFirst({
      where: { email: "hasanlek486@gmail.com" }
    });
    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          email: "hasanlek486@gmail.com",
          password: hashedAdminPassword,
          role: "ADMIN",
        },
      });
      console.log(" seeded default administrator account: hasanlek486@gmail.com / admin123");
    } else {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          password: hashedAdminPassword,
          role: "ADMIN",
        }
      });
      console.log(" verified/updated permanent administrator account: hasanlek486@gmail.com");
    }
  } catch (err) {
    console.error("Error seeding database:", err);
  }
}

// Middleware to authenticate JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token is missing" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: "Access token is invalid or expired" });
    }
    req.user = user;
    next();
  });
};

// Middleware to verify Admin role
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === "ADMIN") {
    next();
  } else {
    res.status(403).json({ error: "Unauthorized. Admin access required." });
  }
};

// --- DATABASE SYNC ENDPOINTS (PERSISTENCE REPLICATION FOR CLOUD RUN / VERCEL) ---

app.get("/api/sync/export", async (req, res) => {
  try {
    const school = await prisma.school.findFirst();
    const schedule = await prisma.schedule.findFirst();
    const location = await prisma.location.findFirst();
    const gurus = await prisma.guru.findMany({
      include: {
        embeddings: true
      }
    });

    res.json({
      school,
      schedule,
      location,
      gurus: gurus.map(g => {
        const parsedEmbeddings = (g.embeddings || []).map((e: any) => {
          let parsedEmb = [];
          try {
            parsedEmb = typeof e.embedding === "string" ? JSON.parse(e.embedding) : e.embedding;
          } catch (err) {
            console.error("Error parsing embedding string:", err);
          }
          return {
            expression: e.expression,
            embedding: parsedEmb
          };
        });

        return {
          ...g,
          foto: null, // Keep payload small to avoid long URLs
          embeddings: parsedEmbeddings
        };
      })
    });
  } catch (err: any) {
    res.status(500).json({ error: "Gagal mengekspor data sinkronisasi: " + err.message });
  }
});

app.post("/api/sync/import", async (req, res) => {
  const { school, schedule, location, gurus } = req.body;

  try {
    // 1. Update/create School
    if (school) {
      const existingSchool = await prisma.school.findFirst();
      if (existingSchool) {
        await prisma.school.update({
          where: { id: existingSchool.id },
          data: {
            name: school.name || existingSchool.name,
            address: school.address || existingSchool.address,
            logo: school.logo || existingSchool.logo,
          }
        });
      } else {
        await prisma.school.create({
          data: {
            name: school.name || "SMK Negeri 1 Jakarta",
            address: school.address || "",
            logo: school.logo,
          }
        });
      }
    }

    // 2. Update/create Schedule
    if (schedule) {
      const existingSchedule = await prisma.schedule.findFirst();
      if (existingSchedule) {
        await prisma.schedule.update({
          where: { id: existingSchedule.id },
          data: {
            name: schedule.name || existingSchedule.name,
            jamMasuk: schedule.jamMasuk || existingSchedule.jamMasuk,
            jamPulang: schedule.jamPulang || existingSchedule.jamPulang,
            hariKerja: schedule.hariKerja || existingSchedule.hariKerja,
            jamToleransi: schedule.jamToleransi !== undefined ? parseInt(String(schedule.jamToleransi), 10) : existingSchedule.jamToleransi,
            timezone: schedule.timezone || existingSchedule.timezone,
          }
        });
      } else {
        await prisma.schedule.create({
          data: {
            name: schedule.name || "Jadwal Kerja Standard Guru",
            jamMasuk: schedule.jamMasuk || "07:00",
            jamPulang: schedule.jamPulang || "14:30",
            hariKerja: schedule.hariKerja || "Senin,Selasa,Rabu,Kamis,Jumat",
            jamToleransi: schedule.jamToleransi !== undefined ? parseInt(String(schedule.jamToleransi), 10) : 15,
            timezone: schedule.timezone || "WIT",
          }
        });
      }
    }

    // 3. Update/create Location
    if (location) {
      const existingLocation = await prisma.location.findFirst();
      if (existingLocation) {
        await prisma.location.update({
          where: { id: existingLocation.id },
          data: {
            name: location.name || existingLocation.name,
            latitude: location.latitude !== undefined ? parseFloat(String(location.latitude)) : existingLocation.latitude,
            longitude: location.longitude !== undefined ? parseFloat(String(location.longitude)) : existingLocation.longitude,
            radius: location.radius !== undefined ? parseFloat(String(location.radius)) : existingLocation.radius,
          }
        });
      } else {
        await prisma.location.create({
          data: {
            name: location.name || "Kampus Utama SMK Negeri 1 Jakarta",
            latitude: location.latitude !== undefined ? parseFloat(String(location.latitude)) : -6.168582,
            longitude: location.longitude !== undefined ? parseFloat(String(location.longitude)) : 106.834044,
            radius: location.radius !== undefined ? parseFloat(String(location.radius)) : 100.0,
          }
        });
      }
    }

    // 4. Update/create Gurus and their User accounts
    if (gurus && Array.isArray(gurus)) {
      const defaultPasswordHash = await bcrypt.hash("guru123", 10);
      for (const g of gurus) {
        // Find existing Guru by NIP or Email
        let existingGuru = await prisma.guru.findFirst({
          where: {
            OR: [
              { NIP: g.NIP },
              { email: g.email }
            ]
          }
        });

        let guruId = existingGuru?.id;

        if (existingGuru) {
          // Update Guru profile
          await prisma.guru.update({
            where: { id: existingGuru.id },
            data: {
              nama: g.nama || existingGuru.nama,
              NIK: g.NIK || existingGuru.NIK,
              jenisKelamin: g.jenisKelamin || existingGuru.jenisKelamin,
              tempatLahir: g.tempatLahir || existingGuru.tempatLahir,
              tanggalLahir: g.tanggalLahir || existingGuru.tanggalLahir,
              alamat: g.alamat || existingGuru.alamat,
              noHP: g.noHP || existingGuru.noHP,
              email: g.email || existingGuru.email,
              status: g.status || existingGuru.status || "AKTIF",
              jabatan: g.jabatan || existingGuru.jabatan || "",
              mataPelajaran: g.mataPelajaran || existingGuru.mataPelajaran || "",
              faceID: g.faceID || existingGuru.faceID || null,
            }
          });
        } else {
          // Create new Guru
          const created = await prisma.guru.create({
            data: {
              id: g.id || undefined,
              nama: g.nama,
              NIP: g.NIP,
              NIK: g.NIK,
              jenisKelamin: g.jenisKelamin || "L",
              tempatLahir: g.tempatLahir || "",
              tanggalLahir: g.tanggalLahir || "1980-01-01",
              alamat: g.alamat || "",
              noHP: g.noHP || "",
              email: g.email,
              status: g.status || "AKTIF",
              jabatan: g.jabatan || "",
              mataPelajaran: g.mataPelajaran || "",
              password: g.password || defaultPasswordHash,
              foto: null,
              qrCode: `GURU-QR-${g.NIP}-${g.NIK}`,
              faceID: g.faceID || null,
            }
          });
          guruId = created.id;
        }

        // Import corresponding face embeddings
        if (g.embeddings && Array.isArray(g.embeddings) && g.embeddings.length > 0) {
          await prisma.faceEmbedding.deleteMany({
            where: { guruId: guruId }
          });

          const createEmbeddings = g.embeddings.map((item: any) => ({
            guruId: guruId,
            expression: item.expression,
            embedding: typeof item.embedding === "string" ? item.embedding : JSON.stringify(item.embedding),
          }));

          await prisma.faceEmbedding.createMany({ data: createEmbeddings });
        }

        // Ensure user account exists
        let user = await prisma.user.findFirst({
          where: { email: g.email }
        });

        if (!user) {
          const hashedPassword = await bcrypt.hash("guru123", 10);
          const newUser = await prisma.user.create({
            data: {
              email: g.email,
              password: hashedPassword,
              role: "GURU",
            }
          });
          
          // Link User to Guru
          await prisma.guru.update({
            where: { id: guruId },
            data: { userId: newUser.id }
          });
        } else if (existingGuru && !existingGuru.userId) {
          // Link existing User to Guru if not linked
          await prisma.guru.update({
            where: { id: guruId },
            data: { userId: user.id }
          });
        }
      }
    }

    res.json({ success: true, message: "Database guru dan konfigurasi berhasil disinkronkan!" });
  } catch (err: any) {
    res.status(500).json({ error: "Gagal mengimpor data sinkronisasi: " + err.message });
  }
});

// --- SHORT SYNC LINK SYSTEM ---

app.post("/api/sync/shorten", async (req, res) => {
  const { payload } = req.body;
  if (!payload) {
    return res.status(400).json({ error: "Payload tidak boleh kosong." });
  }

  try {
    // Generate a 6 character short code
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let shortCode = "";
    for (let i = 0; i < 6; i++) {
      shortCode += chars[Math.floor(Math.random() * chars.length)];
    }

    const key = `short_sync_${shortCode}`;
    await prisma.settings.upsert({
      where: { key: key },
      update: { value: JSON.stringify(payload) },
      create: { key: key, value: JSON.stringify(payload) }
    });

    res.json({ success: true, shortCode });
  } catch (err: any) {
    res.status(500).json({ error: "Gagal memendekkan link: " + err.message });
  }
});

app.get("/api/sync/short/:code", async (req, res) => {
  const { code } = req.params;
  try {
    const key = `short_sync_${code}`;
    const setting = await prisma.settings.findUnique({
      where: { key: key }
    });

    if (!setting) {
      return res.status(404).json({ error: "Link pendek tidak ditemukan atau sudah kedaluwarsa." });
    }

    res.json({ success: true, payload: JSON.parse(setting.value) });
  } catch (err: any) {
    res.status(500).json({ error: "Gagal mengambil data link pendek: " + err.message });
  }
});

// --- AUTHENTICATION ENDPOINTS ---

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password wajib diisi." });
  }

  try {
    // Check if user is an Admin
    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role, name: "Administrator" },
          JWT_SECRET,
          { expiresIn: "7d" }
        );
        await logActivity(user.email, "LOGIN", "Admin berhasil masuk ke sistem.", req.ip);
        return res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: "Administrator",
          },
        });
      }
    }

    // Check if user is a Guru
    const guru = await prisma.guru.findUnique({ where: { email } });
    if (guru) {
      if (guru.status === "NON_AKTIF") {
        return res.status(403).json({ error: "Akun Anda dinonaktifkan oleh administrator." });
      }
      const isMatch = await bcrypt.compare(password, guru.password);
      if (isMatch) {
        const token = jwt.sign(
          { id: guru.id, email: guru.email, role: "GURU", name: guru.nama, NIP: guru.NIP },
          JWT_SECRET,
          { expiresIn: "7d" }
        );
        await logActivity(guru.email, "LOGIN", `Guru ${guru.nama} berhasil masuk ke sistem.`, req.ip);
        return res.json({
          token,
          user: {
            id: guru.id,
            email: guru.email,
            role: "GURU",
            name: guru.nama,
            NIP: guru.NIP,
            foto: guru.foto,
          },
        });
      }
    }

    return res.status(400).json({ error: "Email atau password salah." });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server saat login." });
  }
});

app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role === "ADMIN") {
      const user = await prisma.user.findUnique({ where: { email: req.user.email } });
      if (!user) return res.status(404).json({ error: "User tidak ditemukan" });
      return res.json({
        id: user.id,
        email: user.email,
        role: "ADMIN",
        name: "Administrator",
      });
    } else {
      const guru = await prisma.guru.findUnique({
        where: { email: req.user.email },
        include: { embeddings: true },
      });
      if (!guru) return res.status(404).json({ error: "Guru tidak ditemukan" });
      return res.json({
        id: guru.id,
        email: guru.email,
        role: "GURU",
        name: guru.nama,
        NIP: guru.NIP,
        NIK: guru.NIK,
        jenisKelamin: guru.jenisKelamin,
        alamat: guru.alamat,
        noHP: guru.noHP,
        jabatan: guru.jabatan,
        mataPelajaran: guru.mataPelajaran,
        status: guru.status,
        foto: guru.foto,
        faceID: guru.faceID,
        embeddings: guru.embeddings,
      });
    }
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data user." });
  }
});

// --- GURU CRUD ENDPOINTS (ADMIN ONLY) ---

app.get("/api/guru", authenticateToken, requireAdmin, async (req, res) => {
  const { search, status } = req.query;
  try {
    const filters: any = {};
    if (status) {
      filters.status = status as string;
    }
    if (search) {
      filters.OR = [
        { nama: { contains: search as string } },
        { NIP: { contains: search as string } },
        { NIK: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    const gurus = await prisma.guru.findMany({
      where: filters,
      orderBy: { nama: "asc" },
      include: {
        embeddings: {
          select: { id: true, expression: true },
        },
      },
    });
    res.json(gurus);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil daftar guru." });
  }
});

app.get("/api/guru/:id", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  // Allow admins or the self guru to view detail
  if (req.user.role !== "ADMIN" && req.user.id !== id) {
    return res.status(403).json({ error: "Akses ditolak" });
  }
  try {
    const guru = await prisma.guru.findUnique({
      where: { id },
      include: {
        embeddings: true,
      },
    });
    if (!guru) return res.status(404).json({ error: "Guru tidak ditemukan" });
    res.json(guru);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil rincian guru." });
  }
});

app.post("/api/guru", authenticateToken, requireAdmin, async (req: any, res) => {
  const {
    nama,
    NIP,
    NIK,
    jenisKelamin,
    tempatLahir,
    tanggalLahir,
    alamat,
    noHP,
    email,
    jabatan,
    mataPelajaran,
    password,
    foto,
  } = req.body;

  if (!nama || !NIP || !NIK || !email || !password) {
    return res.status(400).json({ error: "Nama, NIP, NIK, Email, dan Password wajib diisi." });
  }

  try {
    const existingNIP = await prisma.guru.findUnique({ where: { NIP } });
    if (existingNIP) return res.status(400).json({ error: "Guru dengan NIP tersebut sudah terdaftar." });

    const existingNIK = await prisma.guru.findUnique({ where: { NIK } });
    if (existingNIK) return res.status(400).json({ error: "Guru dengan NIK tersebut sudah terdaftar." });

    const existingEmail = await prisma.guru.findUnique({ where: { email } });
    if (existingEmail) return res.status(400).json({ error: "Guru dengan Email tersebut sudah terdaftar." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const qrCodeString = `GURU-QR-${NIP}-${NIK}`;

    const guru = await prisma.guru.create({
      data: {
        nama,
        NIP,
        NIK,
        jenisKelamin,
        tempatLahir,
        tanggalLahir,
        alamat,
        noHP,
        email,
        jabatan,
        mataPelajaran,
        status: "AKTIF",
        password: hashedPassword,
        foto: foto || null,
        qrCode: qrCodeString,
      },
    });

    await logActivity(req.user.email, "CREATE_GURU", `Admin mendaftarkan guru baru: ${nama} (${NIP}).`, req.ip);
    res.status(201).json(guru);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Gagal mendaftarkan guru baru." });
  }
});

app.put("/api/guru/:id", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const { nama, jenisKelamin, tempatLahir, tanggalLahir, alamat, noHP, email, jabatan, mataPelajaran, foto, password } =
    req.body;

  // Gurus can only edit their own profile (sub-fields like noHP, alamat, email, password, foto)
  if (req.user.role !== "ADMIN" && req.user.id !== id) {
    return res.status(403).json({ error: "Akses ditolak" });
  }

  try {
    const existingGuru = await prisma.guru.findUnique({ where: { id } });
    if (!existingGuru) return res.status(404).json({ error: "Guru tidak ditemukan." });

    const updateData: any = {};
    if (req.user.role === "ADMIN") {
      if (nama) updateData.nama = nama;
      if (jabatan) updateData.jabatan = jabatan;
      if (mataPelajaran) updateData.mataPelajaran = mataPelajaran;
    }

    if (jenisKelamin) updateData.jenisKelamin = jenisKelamin;
    if (tempatLahir) updateData.tempatLahir = tempatLahir;
    if (tanggalLahir) updateData.tanggalLahir = tanggalLahir;
    if (alamat) updateData.alamat = alamat;
    if (noHP) updateData.noHP = noHP;
    if (email) updateData.email = email;
    if (foto) updateData.foto = foto;

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedGuru = await prisma.guru.update({
      where: { id },
      data: updateData,
    });

    await logActivity(
      req.user.email,
      "UPDATE_GURU",
      `${req.user.role === "ADMIN" ? "Admin" : "Guru"} memperbarui profil guru: ${updatedGuru.nama}.`,
      req.ip
    );

    res.json(updatedGuru);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memperbarui data guru." });
  }
});

app.delete("/api/guru/:id", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id } = req.params;
  try {
    const guru = await prisma.guru.findUnique({ where: { id } });
    if (!guru) return res.status(404).json({ error: "Guru tidak ditemukan" });

    await prisma.guru.delete({ where: { id } });
    await logActivity(req.user.email, "DELETE_GURU", `Admin menghapus guru: ${guru.nama} (${guru.NIP}).`, req.ip);
    res.json({ success: true, message: "Guru berhasil dihapus." });
  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus data guru." });
  }
});

app.post("/api/guru/:id/status", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id } = req.params;
  const { status } = req.body; // "AKTIF" or "NON_AKTIF"

  if (status !== "AKTIF" && status !== "NON_AKTIF") {
    return res.status(400).json({ error: "Status harus AKTIF atau NON_AKTIF." });
  }

  try {
    const updated = await prisma.guru.update({
      where: { id },
      data: { status },
    });
    await logActivity(
      req.user.email,
      "STATUS_GURU",
      `Admin mengubah status ${updated.nama} menjadi ${status}.`,
      req.ip
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengubah status guru." });
  }
});

app.post("/api/guru/:id/reset-password", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id } = req.params;
  try {
    const guru = await prisma.guru.findUnique({ where: { id } });
    if (!guru) return res.status(404).json({ error: "Guru tidak ditemukan" });

    const hashed = await bcrypt.hash("guru123", 10);
    await prisma.guru.update({
      where: { id },
      data: { password: hashed },
    });

    await logActivity(req.user.email, "RESET_PASSWORD", `Admin mereset password guru: ${guru.nama} menjadi 'guru123'.`, req.ip);
    res.json({ success: true, message: "Password guru berhasil di-reset menjadi 'guru123'." });
  } catch (err) {
    res.status(500).json({ error: "Gagal mereset password guru." });
  }
});

app.post("/api/guru/:id/reset-face", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id } = req.params;
  try {
    const guru = await prisma.guru.findUnique({ where: { id } });
    if (!guru) return res.status(404).json({ error: "Guru tidak ditemukan" });

    await prisma.faceEmbedding.deleteMany({ where: { guruId: id } });
    await prisma.guru.update({
      where: { id },
      data: { faceID: null },
    });

    await logActivity(req.user.email, "RESET_FACE", `Admin menghapus seluruh data wajah guru: ${guru.nama}.`, req.ip);
    res.json({ success: true, message: "Data pendaftaran wajah guru berhasil dihapus." });
  } catch (err) {
    res.status(500).json({ error: "Gagal mereset wajah guru." });
  }
});

// --- FACE REGISTRATION ENDPOINTS (ADMIN ONLY) ---

app.post("/api/guru/:id/register-face", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id } = req.params;
  const { embeddings } = req.body; // Array of { expression: string, embedding: number[] }

  if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
    return res.status(400).json({ error: "Data embedding wajah tidak valid atau kosong." });
  }

  try {
    const guru = await prisma.guru.findUnique({ where: { id } });
    if (!guru) return res.status(404).json({ error: "Guru tidak ditemukan." });

    // Clear old embeddings first
    await prisma.faceEmbedding.deleteMany({ where: { guruId: id } });

    // Store new embeddings
    const createData = embeddings.map((item: any) => ({
      guruId: id,
      expression: item.expression,
      embedding: JSON.stringify(item.embedding),
    }));

    await prisma.faceEmbedding.createMany({ data: createData });

    // Assign faceID to Guru
    const faceIDValue = `FACE-${guru.NIP}-${Date.now()}`;
    await prisma.guru.update({
      where: { id },
      data: { faceID: faceIDValue },
    });

    await logActivity(
      req.user.email,
      "REGISTER_FACE",
      `Admin berhasil mendaftarkan ${embeddings.length} foto wajah untuk guru ${guru.nama}.`,
      req.ip
    );

    res.json({ success: true, message: `Berhasil mendaftarkan ${embeddings.length} wajah guru.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan data registrasi wajah." });
  }
});

// --- CONFIGURATION ENDPOINTS (ADMIN & GURU VIEW, ADMIN EDIT) ---

app.get("/api/location", authenticateToken, async (req, res) => {
  try {
    const loc = await prisma.location.findFirst();
    res.json(loc);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data lokasi." });
  }
});

app.put("/api/location", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id, name, latitude, longitude, radius } = req.body;
  try {
    const updated = await prisma.location.update({
      where: { id },
      data: {
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseFloat(radius),
      },
    });
    await logActivity(req.user.email, "UPDATE_LOCATION", `Admin memperbarui koordinat & radius lokasi sekolah.`, req.ip);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Gagal memperbarui lokasi sekolah." });
  }
});

app.get("/api/schedule", authenticateToken, async (req, res) => {
  try {
    const sched = await prisma.schedule.findFirst();
    res.json(sched);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil jadwal kerja." });
  }
});

app.put("/api/schedule", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id, jamMasuk, jamPulang, hariKerja, jamToleransi, timezone } = req.body;
  try {
    const updated = await prisma.schedule.update({
      where: { id },
      data: {
        jamMasuk,
        jamPulang,
        hariKerja,
        jamToleransi: parseInt(jamToleransi, 10),
        timezone: timezone || "WIT",
      },
    });
    await logActivity(req.user.email, "UPDATE_SCHEDULE", `Admin memperbarui jam kerja, jam toleransi, dan timezone sekolah (${timezone || "WIT"}).`, req.ip);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Gagal memperbarui jadwal sekolah." });
  }
});

app.get("/api/school", authenticateToken, async (req, res) => {
  try {
    const sch = await prisma.school.findFirst();
    res.json(sch);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil profil sekolah." });
  }
});

app.put("/api/school", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id, name, address, logo } = req.body;
  try {
    const updated = await prisma.school.update({
      where: { id },
      data: {
        name,
        address,
        logo: logo || undefined,
      },
    });
    await logActivity(req.user.email, "UPDATE_SCHOOL", `Admin memperbarui profil identitas sekolah.`, req.ip);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Gagal memperbarui profil sekolah." });
  }
});

// --- ATTENDANCE SYSTEM ---

app.post("/api/attendance/submit", authenticateToken, async (req: any, res) => {
  const { type, latitude, longitude, selfie, ip, device, browser, address, isManual, notes } = req.body;
  const guruId = req.user.id;

  if (req.user.role !== "GURU") {
    return res.status(403).json({ error: "Hanya Guru yang dapat melakukan absensi." });
  }

  if (!type || (type !== "masuk" && type !== "pulang")) {
    return res.status(400).json({ error: "Jenis absensi harus 'masuk' atau 'pulang'." });
  }

  try {
    const guru = await prisma.guru.findUnique({ where: { id: guruId } });
    if (!guru || guru.status === "NON_AKTIF") {
      return res.status(403).json({ error: "Guru tidak aktif atau tidak terdaftar." });
    }

    // 1. Get location configuration
    const schoolLoc = await prisma.location.findFirst();
    if (schoolLoc && latitude && longitude && !isManual) {
      const distance = calculateGPSDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        schoolLoc.latitude,
        schoolLoc.longitude
      );

      if (distance > schoolLoc.radius) {
        return res.status(400).json({
          error: "Tidak berada di area sekolah.",
          details: `Jarak Anda saat ini: ${Math.round(distance)} meter dari koordinat sekolah. Radius maksimal: ${schoolLoc.radius} meter.`,
        });
      }
    }

    // 2. Get Work Schedule
    const schedule = await prisma.schedule.findFirst();
    if (!schedule) {
      return res.status(500).json({ error: "Konfigurasi jadwal sekolah belum dibuat." });
    }

    const { date: todayDate, time: nowTime } = await getSchoolTime();

    if (type === "masuk") {
      // Check if already clocked-in today
      const alreadyCheckedIn = await prisma.attendance.findFirst({
        where: {
          guruId,
          date: todayDate,
        },
      });

      if (alreadyCheckedIn) {
        return res.status(400).json({ error: "Anda sudah melakukan absensi Masuk hari ini." });
      }

      // Check attendance status based on entry schedule and toleransi
      let finalStatus: "HADIR" | "TERLAMBAT" = "HADIR";
      const [nowH, nowM] = nowTime.split(":").map(Number);
      const [schH, schM] = schedule.jamMasuk.split(":").map(Number);

      const nowMinutes = nowH * 60 + nowM;
      const schMinutes = schH * 60 + schM;
      const lateThreshold = schMinutes + schedule.jamToleransi;

      if (nowMinutes > lateThreshold) {
        finalStatus = "TERLAMBAT";
      }

      const alamatManual = isManual
        ? `Absensi Manual Guru (Sebab: ${notes || "Data wajah belum terdaftar/terbaca"})`
        : (address || "Koordinat Sekolah");

      // Create attendance log
      const newLog = await prisma.attendance.create({
        data: {
          guruId,
          date: todayDate,
          jamMasuk: nowTime,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          alamat: alamatManual,
          ip: ip || req.ip,
          device: device || "Web Portal (Manual)",
          browser: browser || "Chrome",
          selfie: selfie || null,
          status: finalStatus,
        },
      });

      await logActivity(guru.email, "ATTENDANCE_IN", `Absen Masuk Berhasil: ${finalStatus}${isManual ? " (MANUAL)" : ""}`, req.ip);

      // Create internal notification
      await prisma.notification.create({
        data: {
          title: isManual ? "Absen Masuk Manual Berhasil" : "Absen Masuk Berhasil",
          message: `${guru.nama} berhasil absen masuk jam ${nowTime} dengan status ${finalStatus}${isManual ? " secara manual karena kendala wajah." : "."}`,
          type: finalStatus === "HADIR" ? "SUCCESS" : "WARNING",
          recipientId: "ADMIN",
        },
      });

      return res.json({
        success: true,
        message: finalStatus === "HADIR" ? "Selamat datang! Presensi berhasil dilakukan." : "Presensi berhasil, tetapi Anda terlambat.",
        data: newLog,
      });
    } else {
      // CLOCK OUT (PULANG)
      // Find today's check-in log
      const todayLog = await prisma.attendance.findFirst({
        where: {
          guruId,
          date: todayDate,
        },
      });

      if (!todayLog) {
        // Teacher tries to clock out but hasn't clocked in today
        // We'll allow creating a direct checkout or mandate check-in first
        return res.status(400).json({ error: "Anda belum melakukan absen Masuk hari ini." });
      }

      if (todayLog.jamPulang) {
        return res.status(400).json({ error: "Anda sudah melakukan absensi Pulang hari ini." });
      }

      const alamatManualPulang = isManual
        ? `${todayLog.alamat ? todayLog.alamat + " | " : ""}Absen Manual Pulang (Sebab: ${notes || "Data wajah belum terdaftar/terbaca"})`
        : todayLog.alamat;

      // Update log
      const updatedLog = await prisma.attendance.update({
        where: { id: todayLog.id },
        data: {
          jamPulang: nowTime,
          alamat: alamatManualPulang,
          selfie: selfie || todayLog.selfie,
        },
      });

      await logActivity(guru.email, "ATTENDANCE_OUT", `Absen Pulang Berhasil jam ${nowTime}${isManual ? " (MANUAL)" : ""}`, req.ip);

      // Create internal notification for manual check out
      if (isManual) {
        await prisma.notification.create({
          data: {
            title: "Absen Pulang Manual Berhasil",
            message: `${guru.nama} berhasil absen pulang jam ${nowTime} secara manual karena kendala wajah.`,
            type: "INFO",
            recipientId: "ADMIN",
          },
        });
      }

      return res.json({
        success: true,
        message: "Selamat beristirahat! Absen pulang berhasil dicatat.",
        data: updatedLog,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan absensi." });
  }
});

// Retrieve logged-in teacher attendance logs
app.get("/api/attendance/history", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "GURU") {
    return res.status(403).json({ error: "Hanya Guru yang dapat mengakses riwayat." });
  }
  try {
    const logs = await prisma.attendance.findMany({
      where: { guruId: req.user.id },
      orderBy: { date: "desc" },
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil riwayat absensi." });
  }
});

// Admin retrieves all attendance logs
app.get("/api/attendance", authenticateToken, requireAdmin, async (req, res) => {
  const { date, status, search, month, year } = req.query;
  try {
    const filters: any = {};

    if (date) {
      filters.date = date as string;
    } else if (month && year) {
      filters.date = {
        startsWith: `${year}-${String(month).padStart(2, "0")}`,
      };
    } else if (year) {
      filters.date = {
        startsWith: `${year}-`,
      };
    }

    if (status) {
      filters.status = status as string;
    }

    if (search) {
      filters.guru = {
        OR: [
          { nama: { contains: search as string } },
          { NIP: { contains: search as string } },
        ],
      };
    }

    const logs = await prisma.attendance.findMany({
      where: filters,
      include: {
        guru: {
          select: { nama: true, NIP: true, jabatan: true },
        },
      },
      orderBy: { date: "desc" },
    });

    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil logs kehadiran." });
  }
});

// Create manual attendance (Admin overriding, e.g. Izin/Sakit/Alpha)
app.post("/api/attendance/manual", authenticateToken, requireAdmin, async (req: any, res) => {
  const { guruId, date, status, notes, jamMasuk, jamPulang } = req.body; // status: "IZIN", "SAKIT", "ALPHA", "HADIR"
  if (!guruId || !date || !status) {
    return res.status(400).json({ error: "Guru, Tanggal, dan Status wajib diisi." });
  }

  try {
    const guru = await prisma.guru.findUnique({ where: { id: guruId } });
    if (!guru) return res.status(404).json({ error: "Guru tidak ditemukan." });

    // Helper to format HH:MM to HH:MM:SS
    const formatTime = (t: string | null | undefined) => {
      if (!t || t.trim() === "") return null;
      if (t.length === 5) return `${t}:00`;
      return t;
    };

    const finalJamMasuk = formatTime(jamMasuk) || (status === "HADIR" ? "07:00:00" : null);
    const finalJamPulang = formatTime(jamPulang);

    // Check if entry already exists for that date
    const existing = await prisma.attendance.findFirst({
      where: { guruId, date },
    });

    if (existing) {
      // Update existing record
      await prisma.attendance.update({
        where: { id: existing.id },
        data: { 
          status, 
          alamat: notes || `Diperbarui Manual oleh Admin`,
          jamMasuk: finalJamMasuk,
          jamPulang: finalJamPulang,
        },
      });
    } else {
      // Create new
      await prisma.attendance.create({
        data: {
          guruId,
          date,
          status,
          alamat: notes || `Dicatat Manual oleh Admin`,
          jamMasuk: finalJamMasuk,
          jamPulang: finalJamPulang,
        },
      });
    }

    await logActivity(req.user.email, "MANUAL_ATTENDANCE", `Admin mencatat absensi manual (${status}) untuk ${guru.nama} pada ${date}.`, req.ip);
    res.json({ success: true, message: "Absensi guru berhasil dicatat manual." });
  } catch (err) {
    res.status(500).json({ error: "Gagal mencatat absensi manual." });
  }
});

// Update an attendance record
app.put("/api/attendance/:id", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id } = req.params;
  const { date, status, notes, jamMasuk, jamPulang } = req.body;
  if (!status) {
    return res.status(400).json({ error: "Status kehadiran wajib diisi." });
  }
  try {
    const existing = await prisma.attendance.findUnique({
      where: { id },
      include: { guru: true }
    });
    if (!existing) {
      return res.status(404).json({ error: "Data absensi tidak ditemukan." });
    }

    const formatTime = (t: string | null | undefined) => {
      if (!t || t.trim() === "") return null;
      if (t.length === 5) return `${t}:00`;
      return t;
    };

    const finalJamMasuk = formatTime(jamMasuk);
    const finalJamPulang = formatTime(jamPulang);

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        date: date || existing.date,
        status,
        alamat: notes !== undefined ? notes : existing.alamat,
        jamMasuk: finalJamMasuk,
        jamPulang: finalJamPulang,
      }
    });

    await logActivity(
      req.user.email,
      "UPDATE_ATTENDANCE",
      `Admin memperbarui data absensi tanggal ${updated.date} (${status}) untuk guru ${existing.guru?.nama || 'Unknown'}.`,
      req.ip
    );

    res.json({ success: true, message: "Data absensi berhasil diperbarui.", data: updated });
  } catch (err) {
    res.status(500).json({ error: "Gagal memperbarui data absensi." });
  }
});

// Delete an attendance record
app.delete("/api/attendance/:id", authenticateToken, requireAdmin, async (req: any, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.attendance.findUnique({
      where: { id },
      include: { guru: true }
    });
    if (!existing) {
      return res.status(404).json({ error: "Data absensi tidak ditemukan." });
    }
    await prisma.attendance.delete({
      where: { id }
    });
    await logActivity(
      req.user.email,
      "DELETE_ATTENDANCE",
      `Admin menghapus data absensi tanggal ${existing.date} untuk guru ${existing.guru?.nama || 'Unknown'}.`,
      req.ip
    );
    res.json({ success: true, message: "Data absensi berhasil dihapus." });
  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus data absensi." });
  }
});

// --- DASHBOARD STATISTICS ENDPOINTS ---

app.get("/api/stats/admin", authenticateToken, requireAdmin, async (req, res) => {
  const { date: todayStr } = await getSchoolTime();
  const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM

  try {
    const totalGuru = await prisma.guru.count();

    // Today's attendance counters
    const todayLogs = await prisma.attendance.findMany({
      where: { date: todayStr },
    });

    let guruHadirHariIni = 0;
    let guruTerlambatHariIni = 0;
    let guruIzinHariIni = 0;
    let guruSakitHariIni = 0;

    todayLogs.forEach((log) => {
      if (log.status === "HADIR") guruHadirHariIni++;
      else if (log.status === "TERLAMBAT") guruTerlambatHariIni++;
      else if (log.status === "IZIN") guruIzinHariIni++;
      else if (log.status === "SAKIT") guruSakitHariIni++;
    });

    const activeGurus = await prisma.guru.count({ where: { status: "AKTIF" } });
    const totalAbsenHariIni = todayLogs.length;
    const belumAbsenHariIni = Math.max(0, activeGurus - totalAbsenHariIni);

    const totalAbsensiBulanIni = await prisma.attendance.count({
      where: { date: { startsWith: currentMonthStr } },
    });

    // Recent activities (Audit logs)
    const aktivitasTerbaru = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    // Weekly Attendance Trend (Last 7 days)
    const last7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().split("T")[0]);
    }

    const weeklyAttendance = await Promise.all(
      last7Days.map(async (dayStr) => {
        const counts = await prisma.attendance.findMany({ where: { date: dayStr } });
        let hadir = 0;
        let terlambat = 0;
        counts.forEach((c) => {
          if (c.status === "HADIR") hadir++;
          if (c.status === "TERLAMBAT") terlambat++;
        });
        return {
          date: dayStr,
          hadir,
          terlambat,
        };
      })
    );

    // Monthly attendance metrics (last 6 months)
    const monthlyAttendance = [
      { month: "Feb 2026", rate: 88 },
      { month: "Mar 2026", rate: 92 },
      { month: "Apr 2026", rate: 91 },
      { month: "May 2026", rate: 95 },
      { month: "Jun 2026", rate: 94 },
      { month: "Jul 2026", rate: 96 },
    ];

    // Guru Terlambat Terbanyak (Top 5 late)
    const allLateLogs = await prisma.attendance.findMany({
      where: { status: "TERLAMBAT" },
      include: { guru: { select: { nama: true, NIP: true } } },
    });

    const lateMap: Record<string, { nama: string; NIP: string; count: number }> = {};
    allLateLogs.forEach((l) => {
      if (!lateMap[l.guruId]) {
        lateMap[l.guruId] = { nama: l.guru.nama, NIP: l.guru.NIP, count: 0 };
      }
      lateMap[l.guruId].count++;
    });

    const terlambatTerbanyak = Object.values(lateMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Guru Paling Rajin (Highest presence percentage, top 5)
    const allAttendanceLogs = await prisma.attendance.findMany({
      include: { guru: { select: { nama: true, NIP: true } } },
    });

    const attendanceMap: Record<string, { nama: string; NIP: string; present: number; total: number }> = {};
    allAttendanceLogs.forEach((l) => {
      if (!attendanceMap[l.guruId]) {
        attendanceMap[l.guruId] = { nama: l.guru.nama, NIP: l.guru.NIP, present: 0, total: 0 };
      }
      attendanceMap[l.guruId].total++;
      if (l.status === "HADIR" || l.status === "TERLAMBAT") {
        attendanceMap[l.guruId].present++;
      }
    });

    const palingRajin = Object.values(attendanceMap)
      .map((item) => ({
        nama: item.nama,
        NIP: item.NIP,
        rate: item.total > 0 ? Math.round((item.present / item.total) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);

    res.json({
      totalGuru,
      guruHadirHariIni,
      guruTerlambatHariIni,
      guruIzinHariIni,
      guruSakitHariIni,
      belumAbsenHariIni,
      totalAbsensiBulanIni,
      weeklyAttendance,
      monthlyAttendance,
      terlambatTerbanyak,
      palingRajin,
      aktivitasTerbaru,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memproses data statistik dashboard." });
  }
});

app.get("/api/stats/guru", authenticateToken, async (req: any, res) => {
  const guruId = req.user.id;
  const { date: todayStr } = await getSchoolTime();

  try {
    const schedule = await prisma.schedule.findFirst();
    const todayLog = await prisma.attendance.findFirst({
      where: { guruId, date: todayStr },
    });

    const statusHariIni = todayLog ? todayLog.status : "BELUM ABSEN";
    const jamMasuk = todayLog?.jamMasuk || "--:--:--";
    const jamPulang = todayLog?.jamPulang || "--:--:--";

    // Counters
    const allMyLogs = await prisma.attendance.findMany({
      where: { guruId },
    });

    let totalMyLogs = allMyLogs.length;
    let jumlahTerlambat = 0;
    let jumlahIzin = 0;
    let jumlahSakit = 0;
    let jumlahHadir = 0;

    allMyLogs.forEach((l) => {
      if (l.status === "TERLAMBAT") jumlahTerlambat++;
      else if (l.status === "IZIN") jumlahIzin++;
      else if (l.status === "SAKIT") jumlahSakit++;
      else if (l.status === "HADIR") jumlahHadir++;
    });

    const persentaseHadir =
      totalMyLogs > 0 ? Math.round(((jumlahHadir + jumlahTerlambat) / totalMyLogs) * 100) : 0;

    // History last 7 records
    const history7Days = allMyLogs.slice(-7).reverse();

    // Last 5 days trends for charting
    const last5Days: string[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last5Days.push(d.toISOString().split("T")[0]);
    }

    const attendanceTrend = last5Days.map((dateStr) => {
      const log = allMyLogs.find((l) => l.date === dateStr);
      return {
        date: dateStr,
        status: log ? log.status : "ALPHA/LIBUR",
      };
    });

    res.json({
      jamMasuk: schedule?.jamMasuk || "07:00",
      jamPulang: schedule?.jamPulang || "14:30",
      statusHariIni,
      absensiMasukCatat: jamMasuk,
      absensiPulangCatat: jamPulang,
      persentaseHadir,
      jumlahTerlambat,
      jumlahIzin,
      jumlahSakit,
      history7Days,
      attendanceTrend,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil statistik guru." });
  }
});

// --- AUDIT SYSTEM (ADMIN ONLY) ---

app.get("/api/logs", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil audit log." });
  }
});

// --- BACKUP & RESTORE DATABASE ---

app.post("/api/backup/export", authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const users = await prisma.user.findMany();
    const gurus = await prisma.guru.findMany();
    const embeddings = await prisma.faceEmbedding.findMany();
    const attendances = await prisma.attendance.findMany();
    const schedules = await prisma.schedule.findMany();
    const locations = await prisma.location.findMany();
    const schools = await prisma.school.findMany();
    const settings = await prisma.settings.findMany();
    const notifications = await prisma.notification.findMany();
    const logs = await prisma.activityLog.findMany();

    const dump = {
      users,
      gurus,
      embeddings,
      attendances,
      schedules,
      locations,
      schools,
      settings,
      notifications,
      logs,
    };

    await logActivity(req.user.email, "EXPORT_DATABASE", "Admin melakukan ekspor cadangan database lengkap.", req.ip);
    res.json(dump);
  } catch (err) {
    res.status(500).json({ error: "Gagal melakukan ekspor cadangan database." });
  }
});

app.post("/api/backup/restore", authenticateToken, requireAdmin, async (req: any, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: "Data cadangan tidak valid." });

  try {
    // Basic validation of keys
    if (!data.users || !data.gurus || !data.attendances) {
      return res.status(400).json({ error: "Format file cadangan tidak didukung." });
    }

    // Safety truncate & restore using Transaction or separate calls
    // First clear existing
    await prisma.faceEmbedding.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.guru.deleteMany();
    await prisma.user.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.location.deleteMany();
    await prisma.school.deleteMany();
    await prisma.settings.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.activityLog.deleteMany();

    // Re-insert
    if (data.users.length > 0) await prisma.user.createMany({ data: data.users });
    if (data.gurus.length > 0) await prisma.guru.createMany({ data: data.gurus });
    if (data.embeddings && data.embeddings.length > 0) await prisma.faceEmbedding.createMany({ data: data.embeddings });
    if (data.attendances.length > 0) await prisma.attendance.createMany({ data: data.attendances });
    if (data.schedules && data.schedules.length > 0) await prisma.schedule.createMany({ data: data.schedules });
    if (data.locations && data.locations.length > 0) await prisma.location.createMany({ data: data.locations });
    if (data.schools && data.schools.length > 0) await prisma.school.createMany({ data: data.schools });
    if (data.settings && data.settings.length > 0) await prisma.settings.createMany({ data: data.settings });
    if (data.notifications && data.notifications.length > 0) await prisma.notification.createMany({ data: data.notifications });
    if (data.logs && data.logs.length > 0) await prisma.activityLog.createMany({ data: data.logs });

    await logActivity(req.user.email, "RESTORE_DATABASE", "Admin berhasil memulihkan database dari file cadangan.", req.ip);
    res.json({ success: true, message: "Database berhasil dipulihkan dari data cadangan." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memproses pemulihan database." });
  }
});

// --- CORE VITE SERVING & MIDDLEWARE LOOP ---

async function startServer() {
  // Execute seeding routine first to guarantee database is ready
  await seedDatabase();

  // Vite development mode integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart Attendance Guru backend active on port ${PORT}`);
  });
}

startServer();
