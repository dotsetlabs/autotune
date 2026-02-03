import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadConfig } from '../dist/config.js';

function withEnv(next, fn) {
  const prev = {};
  const keys = new Set([...Object.keys(process.env), ...Object.keys(next)]);
  for (const key of keys) {
    prev[key] = process.env[key];
  }

  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === '') {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('loadConfig respects AUTOTUNE_HOME defaults', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autotune-home-'));
  withEnv({ AUTOTUNE_HOME: tempDir, AUTOTUNE_CONFIG_PATH: '' }, () => {
    const config = loadConfig();
    assert.equal(config.traceDir, path.join(tempDir, 'traces'));
    assert.equal(config.deploy.outputDir, path.join(tempDir, 'prompts'));
    assert.equal(config.dbPath, path.join(tempDir, 'autotune.db'));
  });
});

test('loadConfig merges config file overrides', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autotune-config-'));
  const configPath = path.join(tempDir, 'autotune.json');
  fs.writeFileSync(configPath, JSON.stringify({ intervalMinutes: 15, redact: false }, null, 2));

  withEnv({ AUTOTUNE_CONFIG_PATH: configPath, AUTOTUNE_HOME: tempDir }, () => {
    const config = loadConfig();
    assert.equal(config.intervalMinutes, 15);
    assert.equal(config.redact, false);
  });
});
