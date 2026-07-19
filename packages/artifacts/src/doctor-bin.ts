#!/usr/bin/env node
import { DOCTOR_EXIT, runDoctor, type DoctorMode, type DoctorOptions } from './doctor.js';

try {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(helpText());
  } else {
    const report = await runDoctor(parsed.options);
    process.stdout.write(parsed.json ? `${JSON.stringify(report, null, 2)}\n` : human(report));
    process.exitCode = report.exitCode;
  }
} catch (error) {
  process.stderr.write(`tnl-doctor: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = DOCTOR_EXIT.configuration;
}

function parseArguments(args: readonly string[]): {
  options: DoctorOptions;
  json: boolean;
  help: boolean;
} {
  let mode: DoctorMode = 'local';
  let entrypoint: string | undefined;
  let remoteUrl: string | undefined;
  let apiBaseUrl: string | undefined;
  let configPath: string | undefined;
  let integrityPath: string | undefined;
  let timeoutMs = 10_000;
  let skipApi = false;
  let json = false;
  let help = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') json = true;
    else if (argument === '--skip-api') skipApi = true;
    else if (argument === '--help' || argument === '-h') help = true;
    else if (argument === '--mode') mode = value(args, ++index, '--mode') as DoctorMode;
    else if (argument === '--entrypoint') entrypoint = value(args, ++index, '--entrypoint');
    else if (argument === '--remote-url') remoteUrl = value(args, ++index, '--remote-url');
    else if (argument === '--api-base-url') apiBaseUrl = value(args, ++index, '--api-base-url');
    else if (argument === '--config') configPath = value(args, ++index, '--config');
    else if (argument === '--integrity') integrityPath = value(args, ++index, '--integrity');
    else if (argument === '--timeout-ms') timeoutMs = Number(value(args, ++index, '--timeout-ms'));
    else throw new TypeError(`Unknown argument: ${argument}`);
  }
  if (!['local', 'remote'].includes(mode)) throw new TypeError('--mode must be local or remote');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 120_000)
    throw new TypeError('--timeout-ms must be an integer between 250 and 120000');
  return {
    options: {
      mode,
      ...(entrypoint ? { entrypoint } : {}),
      ...(remoteUrl ? { remoteUrl } : {}),
      ...(apiBaseUrl ? { apiBaseUrl } : {}),
      ...(process.env.TNL_API_KEY ? { apiKey: process.env.TNL_API_KEY } : {}),
      ...(configPath ? { configPath } : {}),
      ...(integrityPath ? { integrityPath } : {}),
      timeoutMs,
      skipApi,
    },
    json,
    help,
  };
}

function value(args: readonly string[], index: number, option: string): string {
  const result = args[index];
  if (!result) throw new TypeError(`${option} requires a value`);
  return result;
}

function human(report: Awaited<ReturnType<typeof runDoctor>>): string {
  const lines = [`TNL connection doctor: ${report.ok ? 'PASS' : 'FAIL'} (${report.exitCode})`];
  for (const check of report.checks)
    lines.push(`${check.status.toUpperCase().padEnd(4)} ${check.id}: ${check.message}`);
  lines.push('Credential values were not printed.');
  return `${lines.join('\n')}\n`;
}

function helpText(): string {
  return `Usage: tnl-doctor [options]

Options:
  --mode local|remote       Diagnostic mode (default: local)
  --entrypoint PATH         Built MCP dist/bin.js for local mode
  --remote-url URL          Streamable HTTP MCP endpoint for remote mode
  --api-base-url URL        TNL API origin for the local safe probe
  --config PATH             Client JSON configuration to parse
  --integrity PATH          Bundle integrity manifest to verify
  --timeout-ms NUMBER       Per-probe timeout (250-120000)
  --skip-api                Skip the direct TNL API probe
  --json                    Emit the structured report
  -h, --help                Show this help

TNL_API_KEY is read from the environment and never printed.
`;
}
