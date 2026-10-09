'use strict';

const EventEmitter = require('events');

// Mock ssh2 module
jest.mock('ssh2', () => {
  const EventEmitter = require('events');
  class MockClient extends EventEmitter {
    constructor() {
      super();
      this.connect = jest.fn().mockImplementation(() => {
        process.nextTick(() => this.emit('ready'));
        return this;
      });
      this.exec = jest.fn().mockImplementation((cmd, cb) => {
        const stream = new EventEmitter();
        stream.stderr = new EventEmitter();
        
        process.nextTick(() => {
          if (MockClient.mockError) {
            cb(MockClient.mockError);
          } else {
            cb(null, stream);
            process.nextTick(() => {
              if (MockClient.mockStdout !== undefined) {
                stream.emit('data', Buffer.from(MockClient.mockStdout));
              }
              if (MockClient.mockStderr !== undefined) {
                stream.stderr.emit('data', Buffer.from(MockClient.mockStderr));
              }
              process.nextTick(() => {
                stream.emit('close', MockClient.mockExitCode || 0);
              });
            });
          }
        });
      });
      this.end = jest.fn();
    }
  }
  return { Client: MockClient };
});

const sshService = require('../server/services/sshService');
const ssh2 = require('ssh2');

describe('sshService — fetchErrorLog outcomes and validations', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      LOG_SSH_HOST: 'test-host',
      LOG_SSH_USER: 'test-user',
      LOG_SSH_PASSWORD: 'test-pass',
    };
    ssh2.Client.mockError = null;
    ssh2.Client.mockStdout = '';
    ssh2.Client.mockStderr = '';
    ssh2.Client.mockExitCode = 0;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const validLogDir = '/opt/app/accessms/bin/benefits/batch/logs/BatchGetDd214Response';
  const validBatchName = 'BatchGetDd214Response';
  const validScheduleName = 'on_demand';

  // ── Validation/Sanitization Cases ──────────────────────────────────────────
  test('throws error for invalid logDir (path traversal guard)', () => {
    expect(() =>
      sshService.fetchErrorLog('/etc/passwd', validBatchName, validScheduleName)
    ).toThrow(/outside the allowed directories/);
  });

  test('throws error for invalid batchName (shell injection guard)', () => {
    expect(() =>
      sshService.fetchErrorLog(validLogDir, 'un;safe', validScheduleName)
    ).toThrow(/contains unsafe characters/);
  });

  test('throws error for invalid scheduleName (path traversal guard)', () => {
    expect(() =>
      sshService.fetchErrorLog(validLogDir, validBatchName, '../../unsafe')
    ).toThrow(/contains unsafe characters/);
  });

  // ── SSH Service Outcomes ───────────────────────────────────────────────────
  test('Outcome 1: returns exact message when no matching business error file exists for today', async () => {
    ssh2.Client.mockStdout = 'No business error files avaialble for today';
    const result = await sshService.fetchErrorLog(validLogDir, validBatchName, validScheduleName);
    expect(result).toBe('No business error files avaialble for today');
  });

  test('Outcome 2: returns exact message when matching file exists but is empty/whitespace', async () => {
    ssh2.Client.mockStdout = 'No Business Error Logs found for today';
    const result = await sshService.fetchErrorLog(validLogDir, validBatchName, validScheduleName);
    expect(result).toBe('No Business Error Logs found for today');
  });

  test('Outcome 3: returns log content when matching file exists and has content', async () => {
    const mockLogsContent = 'ERROR: Database connection failed at step 4';
    ssh2.Client.mockStdout = mockLogsContent;
    const result = await sshService.fetchErrorLog(validLogDir, validBatchName, validScheduleName);
    expect(result).toBe(mockLogsContent);
  });

  test('fallback pattern: works when scheduleName is omitted/empty', async () => {
    ssh2.Client.mockStdout = 'Some fallback biz logs';
    const result = await sshService.fetchErrorLog(validLogDir, validBatchName, '');
    expect(result).toBe('Some fallback biz logs');
  });

  test('handles directory missing gracefully', async () => {
    ssh2.Client.mockStdout = 'No log folder found for this batch.';
    const result = await sshService.fetchErrorLog(validLogDir, validBatchName, validScheduleName);
    expect(result).toBe('No log folder found for this batch.');
  });

  test('handles SSH connection/command errors gracefully', async () => {
    ssh2.Client.mockError = new Error('SSH connection timeout');
    await expect(
      sshService.fetchErrorLog(validLogDir, validBatchName, validScheduleName)
    ).rejects.toThrow('SSH connection timeout');
  });
});
