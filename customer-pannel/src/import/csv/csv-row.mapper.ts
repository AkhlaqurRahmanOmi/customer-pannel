import crypto from "crypto";

export type CsvRecord = Record<string, any>;

export type CustomerRow = {
  name: string;
  email: string; // required for matching/upsert
  phoneNumber?: string;
  address?: string;
  about?: string;
};

export type CsvRowMapperConfig = {

  nameKeys?: string[];
  emailKeys?: string[];
  phoneKeys?: string[];
  addressKeys?: string[];
  aboutKeys?: string[];

  requireEmail?: boolean;


  defaultName?: string;
};

const DEFAULT_CONFIG: Required<CsvRowMapperConfig> = {
  nameKeys: ["name", "full_name", "customer_name"],
  emailKeys: ["email", "email_address", "mail"],
  phoneKeys: ["phoneNumber", "phone_number", "phone", "mobile", "mobile_number"],
  addressKeys: ["address", "full_address", "street_address", "street", "location"],
  aboutKeys: ["about", "notes", "description", "bio", "comment"],
  requireEmail: true,
  defaultName: "Unknown",
};

function safeTrim(v: any): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function normalizeEmail(v: any): string {
  return safeTrim(v).toLowerCase();
}

function normalizePhone(v: any): string {
  // Keep it simple and non-destructive; remove common separators.
  const s = safeTrim(v);
  if (!s) return "";
  return s.replace(/[()\s-]/g, "");
}

function buildKeyIndex(record: CsvRecord): Map<string, string> {
  const m = new Map<string, string>();
  for (const key of Object.keys(record)) {
    m.set(key.toLowerCase(), key);
  }
  return m;
}

function pick(record: CsvRecord, keys: string[], keyIndex?: Map<string, string>): string {
  const idx = keyIndex ?? buildKeyIndex(record);

  for (const k of keys) {
    const actualKey = idx.get(k.toLowerCase());
    if (!actualKey) continue;

    const val = safeTrim(record[actualKey]);
    if (val) return val;
  }
  return "";
}

export function mapCsvRecordToCustomer(
  record: CsvRecord,
  config?: CsvRowMapperConfig,
): CustomerRow | null {
  const cfg = { ...DEFAULT_CONFIG, ...(config ?? {}) };
  const idx = buildKeyIndex(record);

  const nameRaw = pick(record, cfg.nameKeys, idx);
  const emailRaw = pick(record, cfg.emailKeys, idx);
  const phoneRaw = pick(record, cfg.phoneKeys, idx);
  const addressRaw = pick(record, cfg.addressKeys, idx);
  const aboutRaw = pick(record, cfg.aboutKeys, idx);

  const email = normalizeEmail(emailRaw);

  if (cfg.requireEmail && !email) return null;

  const name = safeTrim(nameRaw) || cfg.defaultName;
  const phoneNumber = normalizePhone(phoneRaw) || undefined;
  const address = safeTrim(addressRaw) || undefined;
  const about = safeTrim(aboutRaw) || undefined;

  return {
    name,
    email,
    phoneNumber,
    address,
    about,
  };
}

export function computeSourceHash(row: CustomerRow): string {
  const stable = [
    row.name ?? "",
    row.email ?? "",
    row.phoneNumber ?? "",
    row.address ?? "",
    row.about ?? "",
  ].join("|");

  return crypto.createHash("sha256").update(stable, "utf8").digest("hex");
}

export function createCsvRowMapper(config?: CsvRowMapperConfig) {
  return {
    map: (record: CsvRecord) => mapCsvRecordToCustomer(record, config),
    hash: (row: CustomerRow) => computeSourceHash(row),
  };
}
