import fs from "fs/promises";
import path from "path";

export function dataPath(...parts) {
  return path.join(process.cwd(), "data", ...parts);
}

export async function readJson(file, fallback) {
  try {
    const p = dataPath(file);
    const raw = await fs.readFile(p, "utf-8");
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export async function writeJson(file, obj) {
  const p = dataPath(file);
  const tmp = p + ".tmp";
  const data = JSON.stringify(obj, null, 2);
  await fs.writeFile(tmp, data, "utf-8");
  await fs.rename(tmp, p);
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
