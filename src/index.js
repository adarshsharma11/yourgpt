import express from "express";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const app = express();

async function getSheetValues() {
  const rawCreds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!rawCreds) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

  const credentials = JSON.parse(rawCreds);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId =
    process.env.SHEET_ID || "1CIpn0ZjuL7nTVI1EqZw8UmAReGY2tqdWzwqbkmdfH7o";

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

// app.listen(3000, () => {
//   console.log(`server listening on http://localhost:3000`);
// });

// 🔥 REQUIRED FOR VERCEL — export app, DO NOT LISTEN!
export default app;



