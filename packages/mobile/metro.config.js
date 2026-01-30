const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Force Metro to use the mobile package's own React installation
// This prevents React version conflicts in the monorepo
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    react: path.resolve(__dirname, 'node_modules/react'),
    'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  },
};

// Prevent duplicate React modules (blockList may be array or single RegExp in Metro)
const existingBlockList = config.resolver.blockList;
const blockListArray = Array.isArray(existingBlockList)
  ? existingBlockList
  : existingBlockList != null
  ? [existingBlockList]
  : [];
config.resolver.blockList = [
  ...blockListArray,
  // Block React from parent node_modules
  /\.\.\/.+\/node_modules\/react\//,
  /\.\.\/.+\/node_modules\/react-native\//,
];

module.exports = withNativeWind(config, { input: './global.css' });
