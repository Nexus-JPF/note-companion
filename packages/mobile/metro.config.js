const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const fs = require("fs");
const path = require("path");

const mobileRoot = __dirname;
const repoRoot = path.join(mobileRoot, "../..");

/** Resolve a bare specifier from this package only (avoids hoisted React 19 at repo root). */
function resolveFromMobile(moduleName) {
  return require.resolve(moduleName, { paths: [mobileRoot, repoRoot] });
}

let config = getDefaultConfig(mobileRoot);

function packageRootFromEntry(entryFile) {
  let dir = path.dirname(entryFile);
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.dirname(path.dirname(entryFile));
}

function resolvePackageRoot(moduleName, fallbackSegments) {
  try {
    return packageRootFromEntry(resolveFromMobile(moduleName));
  } catch {
    return path.join(mobileRoot, ...fallbackSegments);
  }
}

const clerkJsBrowserEntry = (() => {
  try {
    return resolveFromMobile("@clerk/clerk-js");
  } catch {
    return null;
  }
})();
const clerkJsNativeEntry = clerkJsBrowserEntry
  ? path.join(path.dirname(clerkJsBrowserEntry), "clerk.native.js")
  : null;

const rngPath = path.join(mobileRoot, "node_modules", "react-native-gesture-handler");

// Real package roots — mobile/node_modules/@clerk is not populated in this monorepo.
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    react: path.join(mobileRoot, "node_modules/react"),
    "react-dom": path.join(mobileRoot, "node_modules/react-dom"),
    "react-native": path.join(mobileRoot, "node_modules/react-native"),
    "react-native-gesture-handler": rngPath,
    "@clerk/expo": resolvePackageRoot("@clerk/expo", ["node_modules", "@clerk", "expo"]),
    "@clerk/react": resolvePackageRoot("@clerk/react", ["node_modules", "@clerk", "react"]),
    "@clerk/clerk-js": clerkJsBrowserEntry
      ? packageRootFromEntry(clerkJsBrowserEntry)
      : path.join(repoRoot, "node_modules", "@clerk", "clerk-js"),
    "@clerk/backend": resolvePackageRoot("@clerk/backend", ["node_modules", "@clerk", "backend"]),
    "@clerk/localizations": resolvePackageRoot("@clerk/localizations", [
      "node_modules",
      "@clerk",
      "localizations",
    ]),
    "@clerk/types": resolvePackageRoot("@clerk/types", ["node_modules", "@clerk", "types"]),
    "expo-glass-effect": path.join(mobileRoot, "shims/expo-glass-effect-pkg"),
  },
};

const existingBlockList = config.resolver.blockList;
const blockListArray = Array.isArray(existingBlockList)
  ? existingBlockList
  : existingBlockList != null
    ? [existingBlockList]
    : [];
config.resolver.blockList = [
  ...blockListArray,
  /\.\.\/.+\/node_modules\/react\//,
  /\.\.\/.+\/node_modules\/react-dom\//,
  /\.\.\/.+\/node_modules\/react-native\//,
  /\.\.\/.+\/node_modules\/react-native-gesture-handler\//,
  /\.\.\/.+\/node_modules\/@clerk\//,
  /node_modules[/\\]expo-glass-effect[/\\]/,
];

// withNativeWind → withCssInterop merges resolver but can still leave duplicate React on web.
config = withNativeWind(config, { input: "./global.css" });
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "expo-glass-effect": path.join(mobileRoot, "shims/expo-glass-effect-pkg"),
};

const bareReactFamily = new Set([
  "react",
  "react-dom",
  "react-dom/client",
  "react-dom/server",
  "react-dom/server.browser",
  "scheduler",
]);

/**
 * One physical @clerk/* tree so ClerkProvider and useAuth share the same React context.
 * Do NOT require.resolve("@clerk/clerk-js") on native — Node picks dist/clerk.js (DOM).
 * That throws "undefined is not a function" as soon as ClerkProvider constructs Clerk.
 */
// @clerk/shared must NOT be forced: the repo root has 3.x (from the web app's
// @clerk/nextjs) while @clerk/react / expo / clerk-js need 4.x from their own
// nested node_modules. Forcing the root copy made @clerk/react call
// setClerkJSLoadingErrorPackageName() on a 3.x module -> "undefined is not a
// function" at boot (build 41). Let Metro resolve it relative to the importer.
const forcedClerkPackages = new Set(["react", "expo", "clerk-js"]);

function tryForceClerk(moduleName, platform) {
  if (!moduleName.startsWith("@clerk/")) return null;
  if (!forcedClerkPackages.has(moduleName.split("/")[1])) return null;
  try {
    // Metro sometimes resolves with platform null / "native". Only web wants DOM clerk.js.
    if (moduleName === "@clerk/clerk-js" && platform !== "web" && clerkJsNativeEntry) {
      return {
        type: "sourceFile",
        filePath: clerkJsNativeEntry,
      };
    }
    return {
      type: "sourceFile",
      filePath: resolveFromMobile(moduleName),
    };
  } catch {
    return null;
  }
}

function tryForceGestureHandler(moduleName) {
  if (
    moduleName === "react-native-gesture-handler" ||
    moduleName.startsWith("react-native-gesture-handler/")
  ) {
    try {
      return {
        type: "sourceFile",
        filePath: resolveFromMobile(moduleName),
      };
    } catch {
      return null;
    }
  }
  return null;
}

function tryForceModule(moduleName) {
  if (bareReactFamily.has(moduleName)) {
    try {
      return {
        type: "sourceFile",
        filePath: resolveFromMobile(moduleName),
      };
    } catch {
      return null;
    }
  }
  if (moduleName.startsWith("react/")) {
    try {
      return {
        type: "sourceFile",
        filePath: resolveFromMobile(moduleName),
      };
    } catch {
      return null;
    }
  }
  return null;
}

const previousResolveRequest = config.resolver.resolveRequest;
const urlPolyfillAutoShim = path.join(
  mobileRoot,
  "shims/react-native-url-polyfill-auto.js",
);
const expoRouterToastShim = path.join(mobileRoot, "shims/expo-router-toast.js");
const cssInteropStylesheetShim = path.join(
  mobileRoot,
  "shims/css-interop-native-stylesheet.js",
);
const expoGlassEffectShim = path.join(
  mobileRoot,
  "shims/expo-glass-effect-pkg/index.js",
);
const createNativeStackNavigatorShim = path.join(
  mobileRoot,
  "shims/create-native-stack-navigator.js",
);

function isExpoRouterToast(context, moduleName) {
  if (
    moduleName === "expo-router/build/views/Toast" ||
    moduleName === "expo-router/build/views/Toast.js"
  ) {
    return true;
  }
  if (moduleName === "./Toast" || moduleName === "./Toast.js") {
    const origin = context.originModulePath || "";
    return origin.includes(`${path.sep}expo-router${path.sep}`) && origin.includes("views");
  }
  return false;
}

function isCssInteropNativeStylesheet(context, moduleName) {
  if (
    moduleName === "react-native-css-interop/dist/runtime/native/stylesheet" ||
    moduleName === "react-native-css-interop/dist/runtime/native/stylesheet.js"
  ) {
    return true;
  }
  if (moduleName === "./stylesheet" || moduleName === "./stylesheet.js") {
    const origin = context.originModulePath || "";
    return origin.includes(`${path.sep}react-native-css-interop${path.sep}`) && origin.includes("native");
  }
  return false;
}

function isCreateNativeStackNavigator(context, moduleName) {
  const name = String(moduleName || "").replace(/\\/g, "/");
  if (name.includes("shims/create-native-stack-navigator")) {
    return false;
  }
  if (
    name.endsWith("fork/native-stack/createNativeStackNavigator") ||
    name.endsWith("fork/native-stack/createNativeStackNavigator.js")
  ) {
    return true;
  }
  if (
    name === "./createNativeStackNavigator" ||
    name === "./createNativeStackNavigator.js"
  ) {
    const origin = (context.originModulePath || "").replace(/\\/g, "/");
    return origin.includes("expo-router") && origin.includes("native-stack");
  }
  return false;
}

function isExpoGlassEffect(moduleName) {
  const name = String(moduleName || "").replace(/\\/g, "/");
  if (name.includes("shims/expo-glass-effect")) {
    return false;
  }
  return (
    name === "expo-glass-effect" ||
    name.startsWith("expo-glass-effect/") ||
    name.includes("/expo-glass-effect/")
  );
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform !== "web" &&
    (moduleName === "react-native-url-polyfill/auto" ||
      moduleName === "react-native-url-polyfill/auto.js")
  ) {
    return { type: "sourceFile", filePath: urlPolyfillAutoShim };
  }

  if (platform !== "web" && isExpoRouterToast(context, moduleName)) {
    return { type: "sourceFile", filePath: expoRouterToastShim };
  }

  if (platform !== "web" && isCssInteropNativeStylesheet(context, moduleName)) {
    return { type: "sourceFile", filePath: cssInteropStylesheetShim };
  }

  if (platform !== "web" && isCreateNativeStackNavigator(context, moduleName)) {
    return { type: "sourceFile", filePath: createNativeStackNavigatorShim };
  }

  if (platform !== "web" && isExpoGlassEffect(moduleName)) {
    return { type: "sourceFile", filePath: expoGlassEffectShim };
  }

  const forcedClerk = tryForceClerk(moduleName, platform);
  if (forcedClerk) {
    return forcedClerk;
  }
  const forcedRng = tryForceGestureHandler(moduleName);
  if (forcedRng) {
    return forcedRng;
  }
  const forced = tryForceModule(moduleName);
  if (forced) {
    return forced;
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// After Babel (including Reanimated), wrap each production module factory so a
// boot TypeError reports the source path. Build 32 stacks are only Metro line
// numbers; that hid the file for "undefined is not a function".
const annotateTransformer = path.join(mobileRoot, "metro-eval-annotate-transformer.js");
const previousBabelTransformer = config.transformer?.babelTransformerPath;
if (previousBabelTransformer && previousBabelTransformer !== annotateTransformer) {
  process.env.NC_INNER_BABEL_TRANSFORMER = previousBabelTransformer;
}
config.transformer = {
  ...config.transformer,
  babelTransformerPath: annotateTransformer,
};

module.exports = config;
