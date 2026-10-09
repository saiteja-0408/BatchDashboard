/**
 * useRunCommand.js — manages the async state for a single SSH run-command call.
 *
 * Returns:
 *   execute(command, commandType) — triggers the API call
 *   status   — 'idle' | 'loading' | 'success' | 'error'
 *   output   — stdout (+ stderr) returned by the server
 *   errMsg   — human-readable error description on failure
 *   exitCode — numeric exit code from the remote command
 *   reset    — resets state back to 'idle'
 */

import { useState, useCallback } from 'react';
import { runBatchCommand } from '../services/apiService';

/**
 * @returns {{ execute, status, output, errMsg, exitCode, reset }}
 */
export function useRunCommand() {
  const [status,   setStatus]   = useState('idle');   // 'idle'|'loading'|'success'|'error'
  const [output,   setOutput]   = useState('');
  const [errMsg,   setErrMsg]   = useState('');
  const [exitCode, setExitCode] = useState(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setOutput('');
    setErrMsg('');
    setExitCode(null);
  }, []);

  const execute = useCallback(async (command, commandType) => {
    setStatus('loading');
    setOutput('');
    setErrMsg('');
    setExitCode(null);

    try {
      const result = await runBatchCommand(command, commandType);

      setOutput(result.output ?? '');
      setExitCode(result.exitCode ?? 0);

      if (result.success) {
        setStatus('success');
      } else {
        setErrMsg(result.error || `Command exited with code ${result.exitCode}.`);
        setStatus('error');
      }
    } catch (err) {
      // Axios interceptor already normalises the message
      setErrMsg(err.message || 'SSH execution failed.');
      setOutput('');
      setExitCode(-1);
      setStatus('error');
    }
  }, []);

  return { execute, status, output, errMsg, exitCode, reset };
}
