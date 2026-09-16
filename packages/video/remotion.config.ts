import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setEntryPoint('./src/index.ts');

// Chromium is pre-installed in CI/remote environments; let Remotion find it
// there rather than downloading its own copy.
if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
  Config.setBrowserExecutable(
    process.env.REMOTION_BROWSER_EXECUTABLE ?? null,
  );
}
