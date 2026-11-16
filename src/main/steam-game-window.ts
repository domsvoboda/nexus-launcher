import { spawn } from 'node:child_process';
import path from 'node:path';

export function steamWindowAppId(environment: NodeJS.ProcessEnv): number | undefined {
  if (!environment.XDG_CURRENT_DESKTOP?.split(':').some(value => value.toLowerCase() === 'gamescope')) return;
  const game = environment.SteamGameId;
  if (!game || !/^[1-9][0-9]{0,19}$/.test(game) || BigInt(game) > 0xffffffffffffffffn) return;
  const id = BigInt(game) >> 32n;
  // Non-Steam shortcuts encode the real generated ID in the high 32 bits.
  if (id < 0x80000000n || environment.SteamAppId !== String(id)) return;
  return Number(id);
}

export function watchSteamGameWindow(pid: number | undefined, environment: NodeJS.ProcessEnv, helper: string,
  warn: (message: string) => void = console.warn, launcher = false): () => void {
  const appid = steamWindowAppId(environment);
  if (process.platform !== 'linux' || !pid || !appid) return () => {};
  const child = spawn('python3', [path.resolve(helper), String(pid), String(appid), ...(launcher ? ['--launcher'] : [])], {
    env: environment, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let reported = false;
  let stopping = false;
  const report = () => { if (!reported) { reported = true; warn('Steam game window association is unavailable.'); } };
  child.on('error', report);
  child.stderr.resume();
  child.on('exit', code => { if (!stopping && code) report(); });
  return () => { stopping = true; if (child.exitCode === null && child.signalCode === null) child.kill(); };
}
