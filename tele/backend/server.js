"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const { rateLimit } = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_FILE_BYTES = 50_000_000; // 50 MB (decimal)

const required = ["BOT_TOKEN", "CHAT_ID", "UPLOAD_PASSWORD", "FRONTEND_ORIGIN"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const allowedOrigins = new Set(
  process.env.FRONTEND_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
);

app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));
app.use(cors({
  origin(origin, callback) {
    // Requests without Origin (health checks / command-line clients) are not
    // granted browser CORS access; the upload password is still required.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.get("/health", (_req, res) => res.json({ ok: true }));

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút." }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 2, fieldSize: 1024 },
  fileFilter(_req, file, callback) {
    // Any file type is accepted. Add an allowlist here if your use case needs it.
    if (!file.originalname || file.originalname.includes("\0")) {
      return callback(new Error("Tên file không hợp lệ."));
    }
    callback(null, true);
  }
});

app.post("/api/upload", uploadLimiter, upload.single("file"), async (req, res) => {
  try {
    const suppliedPassword = req.body?.password;
    if (typeof suppliedPassword !== "string" ||
        suppliedPassword.length !== process.env.UPLOAD_PASSWORD.length ||
        !timingSafeEqual(suppliedPassword, process.env.UPLOAD_PASSWORD)) {
      return res.status(401).json({ error: "Mật khẩu không chính xác." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Bạn chưa chọn file." });
    }
    if (req.file.size === 0) {
      return res.status(400).json({ error: "File rỗng, vui lòng chọn file khác." });
    }

    const safeName = req.file.originalname.replace(/[\\/\r\n]/g, "_").slice(0, 200);
    const form = new FormData();
    form.append("chat_id", process.env.CHAT_ID);
    form.append("document", new Blob([req.file.buffer], {
      type: req.file.mimetype || "application/octet-stream"
    }), safeName);

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendDocument`,
      {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(120000)
      }
    );

    const telegramResult = await telegramResponse.json().catch(() => null);
    if (!telegramResponse.ok || !telegramResult?.ok) {
      // Do not return Telegram's raw response: it can contain internal details.
      console.error("Telegram sendDocument failed:", telegramResult?.error_code || telegramResponse.status);
      return res.status(502).json({
        error: "Telegram không nhận được file. Kiểm tra Bot Token, Chat ID và giới hạn dung lượng."
      });
    }

    return res.json({
      ok: true,
      message: "File đã được gửi đến Telegram.",
      fileName: safeName,
      fileSize: req.file.size
    });
  } catch (error) {
    console.error("Upload error:", error.name || "Error");
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return res.status(504).json({ error: "Telegram phản hồi quá lâu. Vui lòng thử lại." });
    }
    return res.status(500).json({ error: "Có lỗi máy chủ khi xử lý file." });
  }
});

function timingSafeEqual(a, b) {
  // Compare byte lengths first because timingSafeEqual requires equal-length buffers.
  const crypto = require("node:crypto");
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File vượt quá giới hạn 50 MB." });
    }
    return res.status(400).json({ error: "Dữ liệu upload không hợp lệ." });
  }
  if (err.message === "Origin not allowed by CORS") {
    return res.status(403).json({ error: "Nguồn truy cập không được phép." });
  }
  if (err.message === "File không hợp lệ." || err.message === "Tên file không hợp lệ.") {
    return res.status(400).json({ error: err.message });
  }
  console.error("Request error:", err.name || "Error");
  return res.status(500).json({ error: "Đã xảy ra lỗi máy chủ." });
});

app.listen(PORT, () => {
  console.log(`Telegram file upload API listening on port ${PORT}`);
});
