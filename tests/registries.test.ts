import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractDownloads,
  extractVersion,
  inferPackageName,
  inferRegistry,
  packageEndpoints,
} from '../src/lib/registries.ts';

test('inferRegistry maps known registries', () => {
  assert.equal(inferRegistry('https://pypi.org/project/vigil/'), 'pypi');
  assert.equal(inferRegistry('https://www.npmjs.com/package/@scope/name'), 'npm');
  assert.equal(inferRegistry('https://crates.io/crates/serde'), 'crates');
  assert.equal(inferRegistry('https://github.com/emiliano-go/vigil/releases'), 'github');
  assert.equal(inferRegistry('https://hub.docker.com/r/emiliano/go'), 'dockerhub');
  assert.equal(inferRegistry('https://ghcr.io/emiliano-go/vigil'), 'ghcr');
});

test('inferRegistry rejects unknown hosts and invalid urls', () => {
  assert.equal(inferRegistry('https://example.com/pkg'), null);
  assert.equal(inferRegistry('https://github.com/emiliano-go/vigil'), null);
  assert.equal(inferRegistry('not a url'), null);
});

test('inferPackageName extracts names from each registry url', () => {
  assert.equal(inferPackageName('https://pypi.org/project/seoslug/', 'pypi'), 'seoslug');
  assert.equal(inferPackageName('https://www.npmjs.com/package/@scope/name', 'npm'), '@scope/name');
  assert.equal(inferPackageName('https://crates.io/crates/serde', 'crates'), 'serde');
  assert.equal(inferPackageName('https://github.com/emiliano-go/vigil/releases', 'github'), 'emiliano-go/vigil');
  assert.equal(inferPackageName('https://hub.docker.com/r/emiliano/go', 'dockerhub'), 'emiliano/go');
  assert.equal(inferPackageName('https://ghcr.io/emiliano-go/vigil', 'ghcr'), 'emiliano-go/vigil');
});

test('extractDownloads reads each registry payload', () => {
  assert.equal(extractDownloads('pypi', { data: { last_month: 1200 } }), 1200);
  assert.equal(extractDownloads('npm', { downloads: 540 }), 540);
  assert.equal(extractDownloads('crates', { crate: { downloads: 42 } }), 42);
  assert.equal(extractDownloads('dockerhub', { pull_count: 999 }), 999);
  assert.equal(extractDownloads('github', [{ assets: [{ download_count: 3 }, { download_count: 4 }] }]), 7);
  assert.equal(extractDownloads('ghcr', {}), null);
  assert.equal(extractDownloads('npm', null), null);
});

test('extractVersion reads each registry payload', () => {
  assert.equal(extractVersion('pypi', { info: { version: '1.2.3' } }), '1.2.3');
  assert.equal(extractVersion('npm', { version: '2.0.0' }), '2.0.0');
  assert.equal(extractVersion('crates', { crate: { max_version: '0.9.1' } }), '0.9.1');
  assert.equal(extractVersion('dockerhub', { results: [{ name: 'latest' }] }), 'latest');
  assert.equal(extractVersion('github', [{ tag_name: 'v1.0.0' }]), 'v1.0.0');
  assert.equal(extractVersion('ghcr', { anything: true }), null);
});

test('packageEndpoints targets the right hosts', () => {
  assert.match(packageEndpoints('pypi', 'seoslug').downloads ?? '', /pypistats\.org/);
  assert.match(packageEndpoints('npm', 'left-pad').version ?? '', /registry\.npmjs\.org/);
  assert.match(packageEndpoints('crates', 'serde').downloads ?? '', /crates\.io/);
  assert.equal(packageEndpoints('ghcr', 'emiliano-go/vigil').downloads, null);
});
