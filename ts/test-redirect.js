'use strict';

/**
 * Run the original repository test suite against this TypeScript package.
 *
 * The tests live at <repo>/test and require `../`, which Node would normally
 * resolve to the original JavaScript package. This preload redirects that one
 * module resolution to this package's compiled entry point, so the suite is
 * never copied and always stays in sync with upstream camaro.
 */

const Module = require('node:module');
const path = require('node:path');

const packageDir = __dirname;
const rootEntry = path.resolve(packageDir, '..', 'index.js');
const typescriptEntry = path.join(packageDir, 'dist', 'index.js');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
	const resolved = originalResolveFilename.call(this, request, parent, isMain, options);
	return resolved === rootEntry ? typescriptEntry : resolved;
};
