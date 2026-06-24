// Metro for the monorepo. The app lives in apps/app but consumes @vela/shared, whose canonical
// source sits under supabase/functions/_shared/ and is re-exported from packages/shared (AOD-45
// finding). Watching the workspace root lets Metro resolve both the packages/shared re-export and
// the reach-up into supabase/functions/_shared, so this is the first Metro consumer that validates
// the cross-runtime @vela/shared contract (testing-strategy.md §3.2).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the workspace root so packages/shared and supabase/functions/_shared are in the graph.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the hoisted workspace node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
