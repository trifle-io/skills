#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline/promises');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SKILL_NAMES = ['trifle-stats', 'trifle-traces', 'trifle-cli'];
const SKILLS = {
  'trifle-stats': {
    sourceDir: path.join(PACKAGE_ROOT, 'trifle-stats', 'skills', 'trifle-stats')
  },
  'trifle-traces': {
    sourceDir: path.join(PACKAGE_ROOT, 'trifle-traces', 'skills', 'trifle-traces')
  },
  'trifle-cli': {
    sourceDir: path.join(PACKAGE_ROOT, 'trifle-cli', 'skills', 'trifle-cli')
  }
};

const TARGETS = {
  codex: {
    label: 'OpenAI Codex',
    defaultRoot: () => process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
    destination: (root, skill) => ({
      type: 'directory',
      path: path.join(root, 'skills', skill)
    })
  },
  claude: {
    label: 'Claude Code',
    defaultRoot: () => process.cwd(),
    destination: (root, skill) => ({
      type: 'directory',
      path: path.join(root, '.claude', 'skills', skill)
    })
  },
  cursor: {
    label: 'Cursor',
    defaultRoot: () => process.cwd(),
    destination: (root, skill) => ({
      type: 'file',
      path: path.join(root, '.cursor', 'rules', `${skill}.mdc`)
    })
  },
  windsurf: {
    label: 'Windsurf',
    defaultRoot: () => process.cwd(),
    destination: (root, skill) => ({
      type: 'file',
      path: path.join(root, '.windsurf', 'rules', `${skill}.md`)
    })
  },
  cline: {
    label: 'Cline',
    defaultRoot: () => process.cwd(),
    destination: (root, skill) => ({
      type: 'directory',
      path: path.join(root, '.cline', 'skills', skill)
    })
  },
  hermes: {
    label: 'Hermes Agent',
    defaultRoot: () => path.join(os.homedir(), '.hermes'),
    destination: (root, skill) => ({
      type: 'directory',
      path: path.join(root, 'skills', skill)
    })
  },
  pi: {
    label: 'Pi Coding Agent',
    defaultRoot: () => process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent'),
    destination: (root, skill) => ({
      type: 'directory',
      path: path.join(root, 'skills', skill)
    })
  },
  'pi-project': {
    label: 'Pi Coding Agent project',
    defaultRoot: () => process.cwd(),
    destination: (root, skill) => ({
      type: 'directory',
      path: path.join(root, '.pi', 'skills', skill)
    })
  }
};

async function main(argv) {
  requireNode18();

  if (argv.length === 0) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      printHelp();
      return;
    }

    await interactiveInstall();
    return;
  }

  if (argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    printHelp();
    return;
  }

  if (argv[0] === '--version' || argv[0] === '-v' || argv[0] === 'version') {
    printVersion();
    return;
  }

  const command = argv.shift();
  if (command === 'install') {
    install(argv);
    return;
  }

  if (command === 'skills') {
    if (argv[0] === 'install') {
      argv.shift();
    }
    install(argv);
    return;
  }

  if (TARGETS[command]) {
    install([command, ...argv]);
    return;
  }

  if (command !== 'install') {
    fail(`Unknown command: ${command}`);
  }
}

function requireNode18() {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) {
    fail(`Node.js 18 or newer is required. Current version: ${process.version}`);
  }
}

function install(argv) {
  const options = parseInstallArgs(argv);

  if (options.help) {
    printHelp();
    return;
  }

  runInstall(options);
}

function runInstall(options) {
  const target = TARGETS[options.target];
  const root = resolveUserPath(options.dir || target.defaultRoot());
  const operations = buildOperations(options.target, root, options.skills);
  const conflicts = findConflicts(operations, options.force);

  if (conflicts.length > 0) {
    const lines = conflicts.map((operation) => `- ${operation.skill}: ${operation.destPath}`);
    fail(`Refusing to overwrite changed files. Re-run with --force to overwrite:\n${lines.join('\n')}`);
  }

  for (const operation of operations) {
    performCopy(operation);
  }

  console.log(`Installed Trifle skills for ${target.label}.`);
  console.log(`Root: ${root}`);

  for (const operation of operations) {
    console.log(`${operation.action.padEnd(9)} ${operation.skill} -> ${operation.destPath}`);
  }

  if (options.target === 'codex') {
    console.log('Restart Codex to pick up newly installed skills.');
  }
}

async function interactiveInstall() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log('Trifle installer');
    console.log('');

    const target = await choose(rl, 'Where do you want to install Trifle agent skills?', [
      ['codex', 'Codex global (~/.codex)'],
      ['claude', 'Claude Code project (.claude/skills)'],
      ['cursor', 'Cursor project (.cursor/rules)'],
      ['windsurf', 'Windsurf project (.windsurf/rules)'],
      ['cline', 'Cline project (.cline/skills)'],
      ['hermes', 'Hermes Agent global (~/.hermes/skills)'],
      ['pi', 'Pi global (~/.pi/agent/skills)'],
      ['pi-project', 'Pi project (.pi/skills)']
    ]);

    const defaultRoot = TARGETS[target].defaultRoot();
    const customRoot = await confirm(rl, `Use ${defaultRoot} as the install root?`, true)
      ? null
      : await askRequired(rl, 'Install root path: ');

    const skillChoice = await choose(rl, 'Which skills do you want to install?', [
      ['all', 'All skills'],
      ['trifle-stats', 'trifle-stats'],
      ['trifle-traces', 'trifle-traces'],
      ['trifle-cli', 'trifle-cli'],
      ['custom', 'Choose multiple']
    ]);

    let skills = [skillChoice];
    if (skillChoice === 'custom') {
      const customSkills = await askRequired(
        rl,
        `Enter skills, comma-separated (${SKILL_NAMES.join(', ')}): `
      );
      skills = parseSkillList(customSkills);
    }

    const options = {
      target,
      skills: normalizeSkills(skills),
      dir: customRoot,
      force: false,
      help: false
    };

    const root = resolveUserPath(options.dir || TARGETS[target].defaultRoot());
    const operations = buildOperations(options.target, root, options.skills);
    const conflicts = findConflicts(operations, options.force);

    if (conflicts.length > 0) {
      console.log('');
      console.log('Existing changed files found:');
      for (const operation of conflicts) {
        console.log(`- ${operation.skill}: ${operation.destPath}`);
      }
      options.force = await confirm(rl, 'Overwrite these files?', false);

      if (!options.force) {
        console.log('Install cancelled.');
        return;
      }
    }

    console.log('');
    runInstall(options);
  } finally {
    rl.close();
  }
}

async function choose(rl, question, choices) {
  console.log(question);
  choices.forEach(([_value, label], index) => {
    console.log(`  ${index + 1}. ${label}`);
  });

  while (true) {
    const answer = await rl.question(`Select 1-${choices.length}: `);
    const index = Number.parseInt(answer.trim(), 10) - 1;

    if (choices[index]) {
      console.log('');
      return choices[index][0];
    }

    console.log(`Enter a number from 1 to ${choices.length}.`);
  }
}

async function confirm(rl, question, defaultValue) {
  const suffix = defaultValue ? 'Y/n' : 'y/N';

  while (true) {
    const answer = (await rl.question(`${question} (${suffix}) `)).trim().toLowerCase();

    if (answer === '') {
      return defaultValue;
    }

    if (['y', 'yes'].includes(answer)) {
      return true;
    }

    if (['n', 'no'].includes(answer)) {
      return false;
    }

    console.log('Enter yes or no.');
  }
}

async function askRequired(rl, question) {
  while (true) {
    const answer = (await rl.question(question)).trim();
    if (answer) {
      return answer;
    }
    console.log('Enter a value.');
  }
}

function parseInstallArgs(argv) {
  const options = {
    target: null,
    skills: [],
    dir: null,
    force: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--force') {
      options.force = true;
      continue;
    }

    if (arg === '--skill' || arg === '--skills') {
      const value = argv[index + 1];
      if (!value) {
        fail(`${arg} requires a skill name`);
      }
      options.skills.push(...parseSkillList(value));
      index += 1;
      continue;
    }

    if (arg.startsWith('--skill=')) {
      options.skills.push(...parseSkillList(arg.slice('--skill='.length)));
      continue;
    }

    if (arg.startsWith('--skills=')) {
      options.skills.push(...parseSkillList(arg.slice('--skills='.length)));
      continue;
    }

    if (arg === '--dir') {
      const value = argv[index + 1];
      if (!value) {
        fail('--dir requires a path');
      }
      options.dir = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--dir=')) {
      options.dir = arg.slice('--dir='.length);
      continue;
    }

    if (arg.startsWith('-')) {
      fail(`Unknown option: ${arg}`);
    }

    if (options.target) {
      fail(`Unexpected argument: ${arg}`);
    }

    options.target = arg.toLowerCase();
  }

  if (options.help) {
    return options;
  }

  if (!options.target) {
    fail('Missing install target');
  }

  if (!TARGETS[options.target]) {
    fail(`Unknown target: ${options.target}. Expected one of: ${Object.keys(TARGETS).join(', ')}`);
  }

  options.skills = normalizeSkills(options.skills);
  return options;
}

function parseSkillList(value) {
  return value
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function normalizeSkills(skills) {
  if (skills.length === 0 || skills.includes('all')) {
    return SKILL_NAMES;
  }

  const unique = [];
  for (const skill of skills) {
    if (!SKILLS[skill]) {
      fail(`Unknown skill: ${skill}. Expected one of: ${SKILL_NAMES.join(', ')}`);
    }
    if (!unique.includes(skill)) {
      unique.push(skill);
    }
  }

  return unique;
}

function buildOperations(targetName, root, skills) {
  return skills.map((skill) => {
    const sourceDir = SKILLS[skill].sourceDir;
    const sourceSkillFile = path.join(sourceDir, 'SKILL.md');
    const target = TARGETS[targetName].destination(root, skill);

    if (!fs.existsSync(sourceSkillFile)) {
      fail(`Package is missing source skill file: ${sourceSkillFile}`);
    }

    return {
      skill,
      type: target.type,
      sourceDir,
      sourceSkillFile,
      destPath: target.path,
      action: 'install'
    };
  });
}

function findConflicts(operations, force) {
  const conflicts = [];

  for (const operation of operations) {
    if (!fs.existsSync(operation.destPath)) {
      operation.action = 'install';
      continue;
    }

    const same = operation.type === 'directory'
      ? directoryContainsSource(operation.sourceDir, operation.destPath)
      : sameFile(operation.sourceSkillFile, operation.destPath);

    if (same) {
      operation.action = 'unchanged';
      continue;
    }

    operation.action = 'update';

    if (!force) {
      conflicts.push(operation);
    }
  }

  return conflicts;
}

function performCopy(operation) {
  if (operation.action === 'unchanged') {
    return;
  }

  if (operation.type === 'directory') {
    ensureDirectory(path.dirname(operation.destPath));
    fs.cpSync(operation.sourceDir, operation.destPath, {
      recursive: true,
      force: true
    });
    return;
  }

  ensureDirectory(path.dirname(operation.destPath));
  fs.copyFileSync(operation.sourceSkillFile, operation.destPath);
}

function directoryContainsSource(sourceDir, destDir) {
  if (!fs.existsSync(destDir) || !fs.statSync(destDir).isDirectory()) {
    return false;
  }

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (!fs.existsSync(destPath)) {
      return false;
    }

    if (entry.isDirectory()) {
      if (!directoryContainsSource(sourcePath, destPath)) {
        return false;
      }
      continue;
    }

    if (!entry.isFile() || !fs.statSync(destPath).isFile() || !sameFile(sourcePath, destPath)) {
      return false;
    }
  }

  return true;
}

function sameFile(first, second) {
  try {
    return fs.readFileSync(first, 'utf8') === fs.readFileSync(second, 'utf8');
  } catch (_error) {
    return false;
  }
}

function ensureDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resolveUserPath(value) {
  if (value === '~') {
    return os.homedir();
  }

  if (value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2));
  }

  return path.resolve(value);
}

function printHelp() {
  console.log(`Trifle installer

Usage:
  trifle-install
  trifle-install install <target> [options]
  trifle-install skills <target> [options]
  trifle-install --help
  trifle-install --version

Targets:
  codex       Install into CODEX_HOME, or ~/.codex by default
  claude      Install into .claude/skills in the current project
  cursor      Install into .cursor/rules in the current project
  windsurf    Install into .windsurf/rules in the current project
  cline       Install into .cline/skills in the current project
  hermes      Install into ~/.hermes/skills
  pi          Install into PI_CODING_AGENT_DIR, or ~/.pi/agent by default
  pi-project  Install into .pi/skills in the current project

Options:
  --skill <name>  Install one skill. Repeat or comma-separate for multiple.
  --dir <path>    Override the install root. For Codex, this is CODEX_HOME.
  --force         Overwrite changed destination files.
  -h, --help      Show this help.
  -v, --version   Show package version.

Skills:
  ${SKILL_NAMES.join(', ')}

Examples:
  npx -y @trifle-io/install
  npx -y @trifle-io/install install codex
  npx -y @trifle-io/install skills claude --dir /path/to/project
  npx -y @trifle-io/install skills cursor --skill trifle-stats
`);
}

function printVersion() {
  const pkg = require(path.join(PACKAGE_ROOT, 'package.json'));
  console.log(pkg.version);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

try {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
