import { resolve } from 'node:path';
import { homedir } from 'node:os';

/** Root of every WorkPal-managed folder on disk. Every path-accepting endpoint
 *  must validate that its resolved target stays inside this root — shared from
 *  one place so `resolveSessionFolder`, `resolveProjectFolder`, and any future
 *  6.X sibling can't drift. */
export const WORKPAL_ROOT = resolve(homedir(), 'WorkPal');
