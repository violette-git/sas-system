const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const wsShim = path.resolve(__dirname, 'src/shims/ws.js');
const emptyShim = path.resolve(__dirname, 'src/shims/empty.js');

// Node.js built-in → browser-compatible polyfill map
const nodeModuleMap = {
  events: require.resolve('events/'),
  stream: require.resolve('stream-browserify'),
  'readable-stream': require.resolve('readable-stream'),
  url: require.resolve('url/'),
  http: emptyShim,
  https: emptyShim,
  net: emptyShim,
  tls: emptyShim,
  fs: emptyShim,
  crypto: emptyShim,
  zlib: emptyShim,
  os: emptyShim,
  path: emptyShim,
};

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...nodeModuleMap,
  ws: wsShim,
};

// resolveRequest intercepts ALL imports — including ws/* sub-paths —
// which extraNodeModules alone cannot catch.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect the entire ws package and any of its sub-paths to our shim
  if (moduleName === 'ws' || moduleName.startsWith('ws/')) {
    return { filePath: wsShim, type: 'sourceFile' };
  }
  // Redirect Node.js built-ins
  if (nodeModuleMap[moduleName]) {
    return { filePath: nodeModuleMap[moduleName], type: 'sourceFile' };
  }
  // Fall back to default resolution
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
