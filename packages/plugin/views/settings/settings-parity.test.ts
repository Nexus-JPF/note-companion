/**
 * Parity guard between the two settings UIs.
 *
 * Obsidian 1.13+ builds settings from getSettingDefinitions() and skips the
 * plugin's own React screens (display()). Anything that exists only in the
 * React screens is invisible to users on current Obsidian. That already
 * happened once (usage, plan and top-up disappeared), so this test fails when
 * a setting or feature exists in the React tabs but not in the definitions.
 *
 * It reads the React sources as text and extracts the setting keys they write:
 *   - plugin.settings.<key> = ...
 *   - handler calls that end with the key as a string, e.g.
 *     handleToggleChange(value, setX, 'enableX')
 * New write patterns need adding to extractReactSettingKeys, and the sanity
 * check below fails loudly if extraction stops matching anything.
 */
import fs from "node:fs";
import path from "node:path";

jest.mock("obsidian", () => ({
  Notice: class {},
  Setting: class {},
  TFile: class {},
  TFolder: class {},
  normalizePath: (p: string) => p,
  requestUrl: jest.fn(),
}));

import {
  getNoteCompanionSettingDefinitions,
  type NoteCompanionSettingDefinition,
} from "./setting-definitions";

/** In the React screens but not yet in the declarative UI. Remove an entry when it is fixed. */
const KNOWN_GAPS: Record<string, string> = {
  ignoreFolders:
    "Folders excluded from AI organization. Only in the React Advanced screen; needs a list or textarea control in the declarative UI.",
  chatMaxStepsPreference:
    "Chat action-count preference (auto, 3 or 5). Only in the React Experiment tab; needs a dropdown that stores number or 'auto'.",
};

/** Written by the React screens but not a user-facing setting. */
const NOT_USER_FACING: Record<string, string> = {
  useFolderEmbeddings:
    "Forced to false on mount by the React Customization tab; users cannot change it.",
};

const REACT_SCREENS = fs
  .readdirSync(__dirname)
  .filter(name => name.endsWith("-tab.tsx") || name === "account-data.tsx");

function extractReactSettingKeys(source: string): string[] {
  const keys = new Set<string>();
  for (const match of source.matchAll(/plugin\.settings\.(\w+)\s*=(?!=)/g)) {
    keys.add(match[1]);
  }
  for (const match of source.matchAll(
    /handle\w+\([^;]*?,\s*['"](\w+)['"]\s*\)/g
  )) {
    keys.add(match[1]);
  }
  return [...keys];
}

function collectDefinitionKeys(
  definitions: NoteCompanionSettingDefinition[],
  into = new Set<string>()
): Set<string> {
  for (const definition of definitions) {
    if (definition.control?.key) into.add(definition.control.key);
    if (definition.items) collectDefinitionKeys(definition.items, into);
  }
  return into;
}

function collectNames(
  definitions: NoteCompanionSettingDefinition[],
  into = new Set<string>()
): Set<string> {
  for (const definition of definitions) {
    if (definition.name) into.add(definition.name);
    if (definition.items) collectNames(definition.items, into);
  }
  return into;
}

const definitions = getNoteCompanionSettingDefinitions({
  settings: {},
  app: { vault: { getAbstractFileByPath: () => null } },
} as never);

const reactKeys = new Set(
  REACT_SCREENS.flatMap(name =>
    extractReactSettingKeys(fs.readFileSync(path.join(__dirname, name), "utf8"))
  )
);
const definitionKeys = collectDefinitionKeys(definitions);

describe("settings parity (React screens vs Obsidian 1.13+ definitions)", () => {
  it("finds the React screens and extracts their setting keys", () => {
    // Guards the extraction itself: if it silently matched nothing, the
    // parity check below would pass for the wrong reason.
    expect(REACT_SCREENS.length).toBeGreaterThanOrEqual(4);
    expect(reactKeys.size).toBeGreaterThanOrEqual(30);
  });

  it("exposes every React setting in the definitions, or lists it as a known gap", () => {
    const unaccounted = [...reactKeys]
      .filter(
        key =>
          !definitionKeys.has(key) && !(key in KNOWN_GAPS) && !(key in NOT_USER_FACING)
      )
      .sort();
    // A failure here means a setting is invisible on Obsidian 1.13+.
    // Add it to setting-definitions.ts (preferred) or, with a reason, to KNOWN_GAPS.
    expect(unaccounted).toEqual([]);
  });

  it("keeps KNOWN_GAPS and NOT_USER_FACING honest", () => {
    // Fixed a gap? Remove it from KNOWN_GAPS so the list only shrinks.
    const resolved = Object.keys(KNOWN_GAPS).filter(key => definitionKeys.has(key));
    expect(resolved).toEqual([]);
    const stale = [...Object.keys(KNOWN_GAPS), ...Object.keys(NOT_USER_FACING)].filter(
      key => !reactKeys.has(key)
    );
    expect(stale).toEqual([]);
  });

  it("keeps the features that only the React screens used to render", () => {
    const names = collectNames(definitions);
    expect(definitionKeys.has("API_KEY")).toBe(true);
    expect(names.has("Usage this month")).toBe(true);
    expect(names.has("Top up")).toBe(true);
  });

  it("does not promise usage on a page that has no usage row", () => {
    // The General page once described itself as "License key, usage, and chat
    // options" while containing no usage row.
    const claimsUsage = definitions.filter(d => /usage/i.test(d.desc ?? ""));
    expect(claimsUsage.length).toBeGreaterThan(0);
    for (const page of claimsUsage) {
      const names = [...collectNames(page.items ?? [])];
      expect(names.some(name => /usage/i.test(name))).toBe(true);
    }
  });
});

describe("extractReactSettingKeys", () => {
  it("finds assignments and handler string arguments, ignoring comparisons", () => {
    const source = `
      plugin.settings.alpha = 1;
      if (plugin.settings.beta === 2) {}
      void handleToggleChange(value, setGamma, 'gamma');
      handleSettingChange(e.target.value, setDelta, "delta");
    `;
    expect(extractReactSettingKeys(source).sort()).toEqual(["alpha", "delta", "gamma"]);
  });
});
