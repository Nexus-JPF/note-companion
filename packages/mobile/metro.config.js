const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const mobileRoot = __dirname;

/** Resolve a bare specifier from this package only (avoids hoisted React 19 at repo root). */
function resolveFromMobile(moduleName) {
  return require.resolve(moduleName, { paths: [mobileRoot] });
}

let config = getDefaultConfig(mobileRoot);

const clerkScope = path.join(mobileRoot, "node_modules", "@clerk");
const rngPath = path.join(mobileRoot, "node_modules", "react-native-gesture-handler");

// Symlink-style hints for Metro (still helpful for some graph edges).
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    react: path.join(mobileRoot, "node_modules/react"),
    "react-dom": path.join(mobileRoot, "node_modules/react-dom"),
    "react-native": path.join(mobileRoot, "node_modules/react-native"),
    "react-native-gesture-handler": rngPath,
    "@clerk/clerk-expo": path.join(clerkScope, "clerk-expo"),
    "@clerk/clerk-react": path.join(clerkScope, "clerk-react"),
    "@clerk/clerk-js": path.join(clerkScope, "clerk-js"),
    "@clerk/shared": path.join(clerkScope, "shared"),
    "@clerk/backend": path.join(clerkScope, "backend"),
    "@clerk/localizations": path.join(clerkScope, "localizations"),
    "@clerk/types": path.join(clerkScope, "types"),
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
];

// withNativeWind → withCssInterop merges resolver but can still leave duplicate React on web.
config = withNativeWind(config, { input: "./global.css" });

const bareReactFamily = new Set([
  "react",
  "react-dom",
  "react-dom/client",
  "react-dom/server",
  "react-dom/server.browser",
  "scheduler",
]);

/** One physical @clerk/* tree so ClerkProvider and useAuth share the same React context. */
function tryForceClerk(moduleName) {
  if (!moduleName.startsWith("@clerk/")) return null;
  try {
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
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forcedClerk = tryForceClerk(moduleName);
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

module.exports = config;
