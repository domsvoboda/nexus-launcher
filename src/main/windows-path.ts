import { promises as fs } from 'node:fs';
import path from 'node:path';

const fold = (value: string) => value.replace(/[A-Z]/g, letter => letter.toLowerCase());

/** Resolve a Windows package path without guessing among ambiguous Linux files. */
export async function resolvePackageFile(root: string, name: string): Promise<string | undefined> {
  const parts = name.split(/[\\/]+/).filter(Boolean);
  if (!parts.length || parts.some(part => part === '.' || part === '..' || part.includes(':') || part.includes('\0'))) return;
  try {
    const base = await fs.realpath(root);
    const inside = (file: string) => {
      const relative = path.relative(base, file);
      return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    };
    /** Windows treats a package path as one case-insensitive tree. Extraction
     * can instead mirror producer archives that contain entries differing only
     * by case. Try each candidate to completion so an exact-case directory that
     * does not contain the executable cannot hide a valid case-insensitive one. */
    const candidates = async (current: string, index: number): Promise<string[]> => {
      if (index === parts.length) return (await fs.stat(current)).isFile() ? [current] : [];
      const entries = await fs.readdir(current);
      if (entries.includes(parts[index])) {
        const next = path.join(current, parts[index]);
        const real = await fs.realpath(next).catch(() => undefined);
        if (real && inside(real) && (await fs.stat(real).catch(() => undefined))?.isFile()) return [next];
        if (real && inside(real) && (await fs.stat(real).catch(() => undefined))?.isDirectory()) {
          const exact = await candidates(next, index + 1);
          if (exact.length) return exact;
        }
      }
      const folded = entries.filter(entry => entry !== parts[index] && fold(entry) === fold(parts[index]));
      const found: string[] = [];
      for (const entry of folded) {
        const next = path.join(current, entry);
        const real = await fs.realpath(next).catch(() => undefined);
        if (!real || !inside(real)) continue;
        const stat = await fs.stat(real).catch(() => undefined);
        if (index === parts.length - 1 && stat?.isFile()) found.push(next);
        else if (stat?.isDirectory()) found.push(...await candidates(next, index + 1));
      }
      return found;
    };
    const matches = [...new Set(await candidates(base, 0))];
    if (matches.length === 1) return path.relative(base, matches[0]);
  } catch { return undefined; }
}
