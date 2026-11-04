'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const packageDir = __dirname;
const repositoryRoot = path.resolve(packageDir, '..');
const testDirectory = path.join(repositoryRoot, 'test');

let tape;
try {
	const tapeEntry = require.resolve('tape', { paths: [packageDir] });
	tape = path.join(path.dirname(tapeEntry), 'bin', 'tape');
} catch (error) {
	console.error('Unable to find tape. Run `npm install` in ts/ first.');
	process.exit(1);
}

const tests = fs
	.readdirSync(testDirectory)
	.filter((file) => file.endsWith('.test.js'))
	.sort()
	.map((file) => path.join(testDirectory, file));

const nodePath = [path.join(packageDir, 'node_modules'), process.env.NODE_PATH]
	.filter(Boolean)
	.join(path.delimiter);

const result = spawnSync(
	process.execPath,
	['--require', path.join(packageDir, 'test-redirect.js'), tape, ...tests],
	{
		cwd: repositoryRoot,
		stdio: 'inherit',
		env: { ...process.env, NODE_PATH: nodePath },
	}
);

if (result.error) throw result.error;
process.exit(result.status === null ? 1 : result.status);
