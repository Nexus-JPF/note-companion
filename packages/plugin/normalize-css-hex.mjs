import fs from "fs";
import path from "path";

/**
 * Expand 3-digit (#rgb) and 4-digit (#rgba) hex to 6- and 8-digit forms
 * for Obsidian plugin review consistency.
 */
export function normalizeCssHex(css) {
  return css.replace(
    /#([0-9a-fA-F]{3,4})(?![0-9a-fA-F])/gi,
    (_, hex) => `#${hex.split("").map((c) => c + c).join("")}`
  );
}

export function normalizeCssHexFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const css = fs.readFileSync(filePath, "utf8");
  const normalized = normalizeCssHex(css);
  if (normalized !== css) {
    fs.writeFileSync(filePath, normalized, "utf8");
  }
  return true;
}

export function normalizeCssHexInDirectory(dir) {
  const targets = ["styles.css", "main.css"];
  for (const name of targets) {
    normalizeCssHexFile(path.join(dir, name));
  }
}
