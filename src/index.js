import express from "express";
import dotenv from "dotenv";
import { google } from "googleapis";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(express.json());

async function getSheetValues() {
  const rawCreds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!rawCreds) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

  const credentials = JSON.parse(rawCreds);
  if (credentials.private_key) {
  credentials.private_key = credentials.private_key
    .replace(/\\n/g, '\n')        // convert escaped \n
    .replace(/\r/g, '')           // remove any CR
    .trim();                      // remove extra spaces
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId =
    process.env.SHEET_ID || "1G5_VZb9I4KLxBXxcqAjkSbAjR8xTZaO4QLUE-uc0yLE";

  const range = process.env.SHEET_RANGE || "Sheet1";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return res.data.values || [];
}

function normalizeHeader(h) {
  return String(h).toLowerCase().trim().replace(/\s+/g, "_");
}

function rowsToObjects(values) {
  if (!values || values.length === 0) return [];

  const headers = values[0].map(normalizeHeader);
  const out = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};

    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] ?? "";
    }

    out.push(obj);
  }

  return out;
}

app.get("/orders", async (req, res) => {
  try {
    const values = await getSheetValues();
    const items = rowsToObjects(values);

    const q = String(req.query.orderId || "").trim();

    const filtered = q
      ? items.filter((r) => String(r.order_id || "").trim() === q)
      : items;

    res.json({ count: filtered.length, items: filtered });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err });
  }
});

// Send email with JSON body: { email: string, message: string }
app.post("/send-email", async (req, res) => {
  try {
    const { email, message } = req.body || {};
    if (!email || !message) {
      return res.status(400).json({ error: "email and message are required" });
    }

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER || process.env.GMAIL_EMAIL;
    const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.GMAIL_PASSWORD;
    const from = process.env.FROM_EMAIL || user || "no-reply@example.com";

    let transporter;
    if (host && port && user && pass) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else if (user && pass) {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
      });
    } else {
      const account = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: account.user, pass: account.pass },
      });
    }

    const info = await transporter.sendMail({
      from,
      to: email,
      subject: "Message from API",
      text: String(message),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    return res.json({ success: true, messageId: info.messageId, previewUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// const port = process.env.PORT ? Number(process.env.PORT) : 3000;
// app.listen(port, () => {
//   console.log(`server listening on http://localhost:${port}`);
// });

// 🔥 REQUIRED FOR VERCEL — export app, DO NOT LISTEN!
export default app;
