const { updateVersions, generateReleaseArtifacts, prepareReleaseArtifacts, generateReleaseNotes } = require('./packages/release-notes/dist');
const { execSync } = require('child_process');
const path = require('path');

async function run() {
  try {
    const repoRoot = process.cwd();
    
    // Mock git operations for version updates
    const originalExecSync = require('child_process').execSync;
    require('child_process').execSync = function(cmd, options) {
      console.log('Would execute:', cmd);
      
      // Allow git diff and rev-parse commands to execute normally
      if (cmd.startsWith('git diff') || cmd.startsWith('git rev-parse')) {
        return originalExecSync(cmd, options);
      }
      
      // Mock other git commands
      if (cmd.startsWith('git add') || cmd.startsWith('git commit')) {
        return '';
      }
      
      // For unknown commands, execute them
      return originalExecSync(cmd, options);
    };

    // Step 1: Update versions (dry run)
    console.log('\n🔄 Simulating version update...');
    const versionInfo = await updateVersions('patch', repoRoot);
    console.log('Version info:', JSON.stringify(versionInfo, null, 2));
    
    // Step 2: Build plugin
    console.log('\n🏗️  Building plugin...');
    execSync('pnpm --filter "./packages/plugin" build', { stdio: 'inherit' });
    
    // Step 3: Generate release notes
    console.log('\n📝 Generating release notes...');
    const notes = await generateReleaseNotes(versionInfo.previous, {
      repoRoot,
      releaseVersion: versionInfo.new,
      openAIApiKey: process.env.OPENAI_API_KEY
    });
    console.log('Release notes:', JSON.stringify(notes, null, 2));
    
    // Step 4: Prepare artifacts
    console.log('\n📦 Preparing release artifacts...');
    const artifacts = await prepareReleaseArtifacts(versionInfo.new);
    console.log('Artifacts created:', artifacts);
    
    console.log('\n✅ Dry run completed successfully!');
    console.log('This is what would happen in the actual release:');
    console.log(`1. Version would be bumped from ${versionInfo.previous} to ${versionInfo.new}`);
    console.log('2. The following files would be modified:');
    console.log('   - manifest.json');
    console.log('   - packages/plugin/package.json');
    console.log('3. Release artifacts have been created in release-artifacts/');
    console.log('   Files:');
    for (const artifact of artifacts) {
      console.log(`   - ${path.basename(artifact)}`);
    }
    console.log('4. A new GitHub release would be created with the generated notes');
    
  } catch (error) {
    console.error('Error during release simulation:', error);
    if (error.stderr) {
      console.error('Command output:', error.stderr);
    }
    process.exit(1);
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.error('\n❌ Error: OPENAI_API_KEY environment variable is required');
  console.error('Please run the script with your OpenAI API key:');
  console.error('OPENAI_API_KEY=your-key node test-release.js\n');
  process.exit(1);
}

run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 