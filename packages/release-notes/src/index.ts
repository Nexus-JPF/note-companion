import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

export const releaseNotesSchema = z.object({
  releaseNotes: z.object({
    name: z
      .string()
      .describe(
        'A short theme title for the release (do not include the version number)'
      ),
    description: z
      .string()
      .describe('A user-friendly description of the changes and new features'),
    technicalChanges: z
      .array(z.string())
      .describe('Array of specific technical changes made'),
  }),
});

export type ReleaseNotes = z.infer<typeof releaseNotesSchema>['releaseNotes'];

interface ChangedFilesInfo {
  diff: string;
  changedFiles: string[];
}

function getDiffAndChangedFiles(
  repoRoot: string,
  targetVersion: string
): ChangedFilesInfo {
  try {
    // Get the current HEAD commit hash for comparison
    const currentCommit = execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
      cwd: repoRoot,
    }).trim();

    // Use HEAD if targetVersion doesn't exist
    const compareVersion = execSync(
      `git rev-parse --verify ${targetVersion} 2>/dev/null || echo ${currentCommit}`,
      {
        encoding: 'utf-8',
        cwd: repoRoot,
      }
    ).trim();

    const diff = execSync(`git diff ${compareVersion} -- packages/plugin`, {
      encoding: 'utf-8',
      cwd: repoRoot,
    });

    const changedFilesOutput = execSync(
      `git diff --name-only ${compareVersion} -- packages/plugin`,
      {
        encoding: 'utf-8',
        cwd: repoRoot,
      }
    );

    const changedFiles = changedFilesOutput
      .split('\n')
      .map((file) => file.trim())
      .filter((file) => file.startsWith('packages/plugin/') && file.length > 0);

    console.log('Changed files in packages/plugin:');
    changedFiles.forEach((file) => console.log(`- ${file}`));

    return { diff, changedFiles };
  } catch (error) {
    console.error('Error getting git diff:', error);
    return { diff: '', changedFiles: [] };
  }
}

export interface GenerateOptions {
  repoRoot: string;
  /** New manifest version for the GitHub release title (e.g. 3.6.20). */
  releaseVersion?: string;
  openAIApiKey?: string;
  anthropicApiKey?: string;
}

/** Obsidian requires the GitHub release title to include the manifest version. */
export function formatReleaseName(releaseVersion: string, theme: string): string {
  const trimmedTheme = theme.trim();
  if (!releaseVersion) {
    return trimmedTheme;
  }
  if (
    trimmedTheme === releaseVersion ||
    trimmedTheme.startsWith(`${releaseVersion} - `) ||
    trimmedTheme.startsWith(`${releaseVersion}: `)
  ) {
    return trimmedTheme;
  }
  return `${releaseVersion} - ${trimmedTheme}`;
}

function applyReleaseVersion(
  notes: ReleaseNotes,
  releaseVersion?: string
): ReleaseNotes {
  if (!releaseVersion) {
    return notes;
  }
  return {
    ...notes,
    name: formatReleaseName(releaseVersion, notes.name),
  };
}

interface VersionInfo {
  previous: string;
  new: string;
  type: 'patch' | 'minor' | 'major';
}

export async function updateVersions(
  increment: VersionInfo['type'],
  repoRoot: string
): Promise<VersionInfo> {
  const manifestPath = path.join(repoRoot, 'manifest.json');
  const manifestContent = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestContent);
  const previousVersion = manifest.version;
  const [major, minor, patch] = previousVersion.split('.').map(Number);

  let newVersion;
  switch (increment) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }

  // Update manifest.json
  manifest.version = newVersion;
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  // Update package.json in plugin directory
  const pluginPackagePath = path.join(repoRoot, 'packages/plugin/package.json');
  const pluginPackageContent = await fs.readFile(pluginPackagePath, 'utf-8');
  const pluginPackage = JSON.parse(pluginPackageContent);
  pluginPackage.version = newVersion;
  await fs.writeFile(pluginPackagePath, JSON.stringify(pluginPackage, null, 2));

  // Stage the changes
  execSync('git add manifest.json packages/plugin/package.json', {
    cwd: repoRoot,
  });
  execSync(`git commit -m "chore(release): bump version to ${newVersion}"`, {
    cwd: repoRoot,
  });

  return {
    previous: previousVersion,
    new: newVersion,
    type: increment,
  };
}

const RELEASE_NOTES_PROMPT = `You are a release notes generator for an Obsidian plugin called Note Companion.
Given the following git diff between versions, generate a short theme title (name) and description.
The name must be a catchy theme only — do not include version numbers (the version is added separately).
Focus on the user-facing changes and new features that will benefit users.
Note Companion is an Obsidian plugin that helps you organize your files and notes.

It has a sidebar with a ai chat interface that interfaces with many obsidian capabilities.

Chat interface is in:
/views/assistant/ai-chat/chat.tsx

Organizer is in:
/views/assistant/organizer/organizer.tsx

You can do things like:
- Tag my book notes with relevant categories
- Analyze my vault structure and suggest improvements
- Help me set up my vault organization settings
- Show me my recently modified files
- Add notes from this YouTube video (and more)

In the side bar there's also an "organizer" tab that allows you to organize your files and notes.
It does things like:
- Suggest new file names
- Tag my files with relevant categories
- Move files to different folders

On top of that there's a special "inbox" functionality that automatically tags and categorizes files based on their content.

When users drop files in their Obsidian vault special inbox folder, Note Companion will automatically tag and categorize them.
They then can view in the "inbox" tab. the changes that were made to the files.`;

/**
 * Generate fallback release notes based on changed files when AI providers fail.
 * This ensures the release can still proceed even without AI-generated notes.
 */
function generateFallbackReleaseNotes(changedFiles: string[]): ReleaseNotes {
  console.log('Generating fallback release notes from changed files...');

  // Categorize changes by area
  const areas = {
    chat: false,
    organizer: false,
    inbox: false,
    settings: false,
    ui: false,
    other: false,
  };

  const technicalChanges: string[] = [];

  for (const file of changedFiles) {
    const fileName = file.replace('packages/plugin/', '');

    if (fileName.includes('chat') || fileName.includes('assistant')) {
      areas.chat = true;
    }
    if (fileName.includes('organizer')) {
      areas.organizer = true;
    }
    if (fileName.includes('inbox')) {
      areas.inbox = true;
    }
    if (fileName.includes('settings')) {
      areas.settings = true;
    }
    if (
      fileName.includes('view') ||
      fileName.includes('component') ||
      fileName.includes('.css')
    ) {
      areas.ui = true;
    }

    // Add simplified file change as technical change
    if (!fileName.includes('dist/') && !fileName.includes('node_modules/')) {
      technicalChanges.push(`Updated ${fileName}`);
    }
  }

  // Build description based on areas affected
  const affectedAreas: string[] = [];
  if (areas.chat) affectedAreas.push('AI chat assistant');
  if (areas.organizer) affectedAreas.push('file organizer');
  if (areas.inbox) affectedAreas.push('inbox processing');
  if (areas.settings) affectedAreas.push('settings');
  if (areas.ui) affectedAreas.push('user interface');

  let description: string;
  let name: string;

  if (affectedAreas.length > 0) {
    description = `This release includes updates to ${affectedAreas.join(
      ', '
    )}. ${
      changedFiles.length
    } file(s) were modified to improve functionality and user experience.`;
    name = `Improvements to ${affectedAreas.slice(0, 2).join(' & ')}`;
  } else {
    description = `This release includes various improvements and updates. ${changedFiles.length} file(s) were modified.`;
    name = 'Plugin Update';
  }

  // Limit technical changes to first 10
  const limitedTechnicalChanges = technicalChanges.slice(0, 10);
  if (technicalChanges.length > 10) {
    limitedTechnicalChanges.push(
      `... and ${technicalChanges.length - 10} more changes`
    );
  }

  return {
    name,
    description,
    technicalChanges:
      limitedTechnicalChanges.length > 0
        ? limitedTechnicalChanges
        : ['Various internal improvements and bug fixes'],
  };
}

/**
 * Try to generate release notes with OpenAI
 */
async function tryOpenAI(diff: string, apiKey: string): Promise<ReleaseNotes> {
  console.log('Attempting to generate release notes with OpenAI...');

  const openai = createOpenAI({ apiKey });
  const model = openai('gpt-4.1');

  const { object } = await generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    schema: releaseNotesSchema,
    prompt: `${RELEASE_NOTES_PROMPT}\n\n${diff.slice(0, 100000)}`,
  });

  console.log('Successfully generated release notes with OpenAI');
  return object.releaseNotes;
}

/**
 * Try to generate release notes with Anthropic
 */
async function tryAnthropic(
  diff: string,
  apiKey: string
): Promise<ReleaseNotes> {
  console.log('Attempting to generate release notes with Anthropic...');

  const anthropic = createAnthropic({ apiKey });
  const model = anthropic('claude-3-5-sonnet-20241022');

  const { object } = await generateObject({
    model,
    schema: releaseNotesSchema,
    prompt: `${RELEASE_NOTES_PROMPT}\n\n${diff.slice(0, 100000)}`,
  });

  console.log('Successfully generated release notes with Anthropic');
  return object.releaseNotes;
}

/**
 * Generate release notes with fallback providers.
 *
 * Priority:
 * 1. OpenAI (gpt-4.1)
 * 2. Anthropic (claude-3-5-sonnet)
 * 3. Template-based fallback (always succeeds)
 */
export async function generateReleaseNotes(
  version: string,
  options: GenerateOptions
): Promise<ReleaseNotes> {
  const { diff, changedFiles } = getDiffAndChangedFiles(
    options.repoRoot,
    version
  );
  const errors: Error[] = [];

  const finalize = (notes: ReleaseNotes) =>
    applyReleaseVersion(notes, options.releaseVersion);

  // Try OpenAI first
  if (options.openAIApiKey) {
    try {
      return finalize(await tryOpenAI(diff, options.openAIApiKey));
    } catch (error) {
      console.error(
        'OpenAI failed:',
        error instanceof Error ? error.message : error
      );
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  } else {
    console.log('OpenAI API key not provided, skipping OpenAI...');
  }

  // Try Anthropic as fallback
  if (options.anthropicApiKey) {
    try {
      return finalize(await tryAnthropic(diff, options.anthropicApiKey));
    } catch (error) {
      console.error(
        'Anthropic failed:',
        error instanceof Error ? error.message : error
      );
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  } else {
    console.log('Anthropic API key not provided, skipping Anthropic...');
  }

  // Fall back to template-based generation
  console.log(
    'All AI providers failed or unavailable, using template-based fallback...'
  );
  if (errors.length > 0) {
    console.log('Previous errors:', errors.map((e) => e.message).join('; '));
  }

  return finalize(generateFallbackReleaseNotes(changedFiles));
}

export async function prepareReleaseArtifacts(
  version: string
): Promise<string[]> {
  // Define files and their source locations
  const artifactSources = [
    { name: 'main.js', source: 'packages/plugin/dist' },
    { name: 'styles.css', source: 'packages/plugin/dist' },
    { name: 'manifest.json', source: '.' }, // Root directory
  ];

  // Create release-artifacts directory if it doesn't exist
  await fs.mkdir('release-artifacts', { recursive: true });

  const artifacts = await Promise.all(
    artifactSources.map(async ({ name, source }) => {
      const sourcePath = path.join(source, name);
      const targetPath = path.join('release-artifacts', name);
      try {
        await fs.copyFile(sourcePath, targetPath);
        return targetPath;
      } catch (error) {
        console.error(`Error copying ${sourcePath} to ${targetPath}:`, error);
        throw error;
      }
    })
  );

  // Generate checksums
  const checksums = await Promise.all(
    artifacts.map(async (file) => {
      const content = await fs.readFile(file);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      return `${hash}  ${path.basename(file)}`;
    })
  );

  await fs.writeFile('release-artifacts/checksums.txt', checksums.join('\n'));
  return artifacts;
}

export async function generateReleaseArtifacts(
  version: string,
  options: GenerateOptions
): Promise<void> {
  await Promise.all([
    execSync('pnpm --filter "./packages/plugin" build'),
    generateReleaseNotes(version, options),
    fs.mkdir('release-artifacts', { recursive: true }),
  ]);
}

// CLI support
if (require.main === module) {
  const version = process.argv[2];
  const repoRoot = process.argv[3] || process.cwd();

  if (!version) {
    console.error('Please provide a version number');
    process.exit(1);
  }

  // At least one API key should be provided, or fallback will be used
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.warn(
      'Warning: No AI API keys provided. Fallback template-based release notes will be used.'
    );
  }

  generateReleaseNotes(version, {
    repoRoot,
    openAIApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  })
    .then((notes) => {
      console.log(JSON.stringify(notes, null, 2));
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}
