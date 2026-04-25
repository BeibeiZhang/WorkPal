import { app } from 'electron';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import forge from 'node-forge';
import { log } from './logger.js';

const execFileP = promisify(execFile);

/* 7.3: Local CA + leaf cert for the agent's HTTPS listener.
 *
 * Why a local CA instead of a self-signed leaf:
 *   A self-signed leaf needs per-browser trust (each browser pops its own
 *   warning the first time). A user-installed root CA trusts everything
 *   signed by it across every browser + curl — one confirmation prompt,
 *   done forever.
 *
 * Why login keychain (user-domain trust) and not System Keychain:
 *   Live-test (Bug B) found `osascript ... with administrator privileges`
 *   from the menu-bar (LSUIElement) Electron context fails with "no user
 *   interaction was possible" on first launch — the System Keychain admin
 *   path doesn't reliably surface a UI from a background-equivalent context.
 *   User-domain trust via `~/Library/Keychains/login.keychain-db` only
 *   needs SecurityAgent (Touch ID friendly, no admin password), and
 *   browsers honour user-domain trusted roots for free.
 *
 * Why node-forge over `selfsigned` or `openssl`/`security` subprocess:
 *   - `selfsigned` is a thin wrapper on node-forge optimised for one-cert
 *     self-signed flows; CA + leaf chain falls back to bare node-forge anyway.
 *   - `openssl` / `security` subprocesses bring spawn surface (7.2's ENOTDIR
 *     saga) and brittle stdout parsing.
 *   node-forge is pure JS, no native deps, fully ESM-friendly under
 *   `asar: false`, and emits real X.509 with the extensions browsers need
 *   (basicConstraints CA, keyUsage, SAN with IP + DNS).
 *
 * Why RSA-2048 and not ECDSA P-256:
 *   node-forge's ECDSA cert-signing path is incomplete; the production-grade
 *   path is RSA. 2048-bit key → ~1–3s keygen on first launch (acceptable —
 *   we're already going to gate behind a confirmation prompt) and security
 *   holds to 2030+. Bundle adds ~1.2 MB.
 *
 * Validity windows:
 *   CA:  10 years (RFC 5280-typical for roots; user-installed roots aren't
 *        bound by Apple's 398-day public-CA leaf rule)
 *   Leaf: 397 days, regenerated at boot when <30 days remain. Boot-time
 *        renewal means the listener is always created fresh with the latest
 *        cert; no live restart needed mid-process. Failure during renewal
 *        keeps the old (still valid for some days) bundle and surfaces a
 *        cert-error state for Settings to flag.
 */

export const CA_COMMON_NAME = 'WorkPal Agent CA';
const SERVER_COMMON_NAME = 'WorkPal Agent';
const ORG_NAME = 'WorkPal Agent';
const CA_VALIDITY_DAYS = 3650;
const SERVER_VALIDITY_DAYS = 397;
const RENEWAL_THRESHOLD_DAYS = 30;
const LOGIN_KEYCHAIN = path.join(os.homedir(), 'Library/Keychains/login.keychain-db');

export interface CertBundle {
  caPem: string;
  caKeyPem: string;
  serverCertPem: string;
  serverKeyPem: string;
  serverNotAfter: Date;
}

export interface BootstrapResult {
  bundle: CertBundle;
  /** Set when renewal was attempted at boot and failed. The returned bundle
   *  is the stale-but-still-valid one we already had on disk; HTTPS keeps
   *  working until the leaf actually expires. main.ts flips certState to
   *  'error' and surfaces the bilingual reinstall hint. */
  renewalError?: string;
}

export type CaKeychainStatus = 'matching' | 'mismatch' | 'absent';

function certDir(): string {
  // app.getPath('userData') on macOS = ~/Library/Application Support/<bundle name>
  // Packaged: 'workpal-agent' (npm package name; productName in Info.plist
  // is 'WorkPal Agent' but app.getName() returns the npm name unless we
  // set "productName" in package.json — we don't, to avoid orphaning the
  // existing 7.1/7.2 Electron cache directory). Dev resolves to the same
  // 'workpal-agent' for the same reason. User-writable in both modes; the
  // bundle dir is read-only when packaged so cert files MUST live here.
  return path.join(app.getPath('userData'), 'cert');
}

function caCertPath(): string { return path.join(certDir(), 'ca.crt'); }
function caKeyPath(): string { return path.join(certDir(), 'ca.key'); }
function serverCertPath(): string { return path.join(certDir(), 'server.crt'); }
function serverKeyPath(): string { return path.join(certDir(), 'server.key'); }

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

/** Atomic write via tmp + rename. mode 0600 because these files include
 *  private keys — even though they're under the user's own ~/Library, the
 *  permission bit is cheap defence-in-depth against curious neighbours. */
async function atomicWrite(p: string, data: string): Promise<void> {
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, data, { mode: 0o600 });
  await fs.rename(tmp, p);
  await fs.chmod(p, 0o600);
}

/** Random 64-bit serial with high bit cleared. ASN.1 INTEGER is big-endian
 *  signed; clearing the MSB keeps the serial positive without forge needing
 *  to prepend a leading 0x00 byte. RFC 5280 says serials must be positive. */
function makeSerial(): string {
  const bytes = forge.random.getBytesSync(8);
  const first = bytes.charCodeAt(0) & 0x7f;
  const firstHex = first.toString(16).padStart(2, '0');
  return firstHex + forge.util.bytesToHex(bytes.substring(1));
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

interface KeyAndCert {
  cert: forge.pki.Certificate;
  keys: forge.pki.rsa.KeyPair;
}

function generateCa(): KeyAndCert {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = makeSerial();
  const now = new Date();
  cert.validity.notBefore = now;
  cert.validity.notAfter = addDays(now, CA_VALIDITY_DAYS);
  const attrs: forge.pki.CertificateField[] = [
    { name: 'commonName', value: CA_COMMON_NAME },
    { name: 'organizationName', value: ORG_NAME },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs); // self-signed root
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert, keys };
}

function generateServerCert(caCert: forge.pki.Certificate, caKey: forge.pki.rsa.PrivateKey): KeyAndCert {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = makeSerial();
  const now = new Date();
  cert.validity.notBefore = now;
  cert.validity.notAfter = addDays(now, SERVER_VALIDITY_DAYS);
  cert.setSubject([
    { name: 'commonName', value: SERVER_COMMON_NAME },
    { name: 'organizationName', value: ORG_NAME },
  ]);
  cert.setIssuer(caCert.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true,
      critical: true,
    },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: [
        // type 7 = IP, type 2 = DNS. Browsers verify SAN, not CN, since
        // Chrome 58 — both must be present for `127.0.0.1` and `localhost`.
        { type: 7, ip: '127.0.0.1' },
        { type: 2, value: 'localhost' },
      ],
    },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(caKey, forge.md.sha256.create());
  return { cert, keys };
}

async function persistAll(
  ca: KeyAndCert,
  server: KeyAndCert,
): Promise<CertBundle> {
  const caPem = forge.pki.certificateToPem(ca.cert);
  const caKeyPem = forge.pki.privateKeyToPem(ca.keys.privateKey);
  const serverCertPem = forge.pki.certificateToPem(server.cert);
  const serverKeyPem = forge.pki.privateKeyToPem(server.keys.privateKey);
  await fs.mkdir(certDir(), { recursive: true, mode: 0o700 });
  await Promise.all([
    atomicWrite(caCertPath(), caPem),
    atomicWrite(caKeyPath(), caKeyPem),
    atomicWrite(serverCertPath(), serverCertPem),
    atomicWrite(serverKeyPath(), serverKeyPem),
  ]);
  return {
    caPem,
    caKeyPem,
    serverCertPem,
    serverKeyPem,
    serverNotAfter: server.cert.validity.notAfter,
  };
}

async function persistServerOnly(
  caPem: string,
  caKeyPem: string,
  server: KeyAndCert,
): Promise<CertBundle> {
  const serverCertPem = forge.pki.certificateToPem(server.cert);
  const serverKeyPem = forge.pki.privateKeyToPem(server.keys.privateKey);
  await Promise.all([
    atomicWrite(serverCertPath(), serverCertPem),
    atomicWrite(serverKeyPath(), serverKeyPem),
  ]);
  return {
    caPem,
    caKeyPem,
    serverCertPem,
    serverKeyPem,
    serverNotAfter: server.cert.validity.notAfter,
  };
}

/** Boot-time entry point. Always returns a usable bundle so the HTTPS
 *  listener can start; renewal failure is reported via the renewalError
 *  field for callers to surface on cert-error state. */
export async function bootstrapCerts(): Promise<BootstrapResult> {
  await fs.mkdir(certDir(), { recursive: true, mode: 0o700 });

  const allPresent = (
    await Promise.all([
      fileExists(caCertPath()),
      fileExists(caKeyPath()),
      fileExists(serverCertPath()),
      fileExists(serverKeyPath()),
    ])
  ).every(Boolean);

  if (!allPresent) {
    await log('info', 'cert: bundle missing or partial — generating fresh CA + server cert');
    const ca = generateCa();
    const server = generateServerCert(ca.cert, ca.keys.privateKey);
    const bundle = await persistAll(ca, server);
    await log('info', `cert: generated CA (notAfter=${ca.cert.validity.notAfter.toISOString()}) + server (notAfter=${bundle.serverNotAfter.toISOString()})`);
    return { bundle };
  }

  const [caPem, caKeyPem, serverCertPem, serverKeyPem] = await Promise.all([
    fs.readFile(caCertPath(), 'utf8'),
    fs.readFile(caKeyPath(), 'utf8'),
    fs.readFile(serverCertPath(), 'utf8'),
    fs.readFile(serverKeyPath(), 'utf8'),
  ]);

  const serverCert = forge.pki.certificateFromPem(serverCertPem);
  const msUntilExpiry = serverCert.validity.notAfter.getTime() - Date.now();
  const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24);

  const baseBundle: CertBundle = {
    caPem,
    caKeyPem,
    serverCertPem,
    serverKeyPem,
    serverNotAfter: serverCert.validity.notAfter,
  };

  if (daysUntilExpiry >= RENEWAL_THRESHOLD_DAYS) {
    return { bundle: baseBundle };
  }

  // Renewal path. Reuses the existing CA — no new trust prompt needed
  // because the CA cert in login keychain is unchanged. Per clarify #1:
  // success is silent (no UI), failure flips certState to 'error' so the
  // user knows.
  await log('info', `cert: server leaf expires in ${daysUntilExpiry.toFixed(1)}d — renewing (silent on success)`);
  try {
    const caCert = forge.pki.certificateFromPem(caPem);
    // Narrow PrivateKey union → rsa.PrivateKey: we always generate RSA-2048
    // for the CA (see generateCa), so re-reading the same PEM we wrote yields
    // an RSA key. The forge type is the union, hence the assertion.
    const caKey = forge.pki.privateKeyFromPem(caKeyPem) as forge.pki.rsa.PrivateKey;
    const server = generateServerCert(caCert, caKey);
    const renewed = await persistServerOnly(caPem, caKeyPem, server);
    await log('info', `cert: renewed server leaf (notAfter=${renewed.serverNotAfter.toISOString()})`);
    return { bundle: renewed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log('error', `cert: renewal failed — keeping old leaf for now: ${msg}`);
    return { bundle: baseBundle, renewalError: msg };
  }
}

/** Computes the SHA-1 fingerprint of the on-disk CA in the same hex format
 *  `security find-certificate -Z` prints. Used to differentiate "the CA we
 *  have on disk is trusted" from "some old CA with the same CN is trusted"
 *  (orphan case after a userData wipe). */
async function onDiskCaSha1Hex(): Promise<string | null> {
  try {
    const pem = await fs.readFile(caCertPath(), 'utf8');
    const cert = forge.pki.certificateFromPem(pem);
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const md = forge.md.sha1.create();
    md.update(der);
    return md.digest().toHex().toUpperCase();
  } catch {
    return null;
  }
}

/** Three-way: 'matching' = same CA on disk and in login keychain;
 *  'mismatch' = some "WorkPal Agent CA" exists in login keychain but its
 *  hash doesn't match what's on disk (orphan from a previous install —
 *  installing the current CA on top of it auto-heals); 'absent' = no entry
 *  by that name at all. */
export async function caKeychainStatus(): Promise<CaKeychainStatus> {
  let stdout: string;
  try {
    const result = await execFileP(
      'security',
      ['find-certificate', '-Z', '-c', CA_COMMON_NAME, LOGIN_KEYCHAIN],
      { timeout: 5000 },
    );
    stdout = result.stdout;
  } catch {
    return 'absent';
  }

  const m = stdout.match(/SHA-1 hash:\s*([0-9A-Fa-f]+)/);
  if (!m) return 'absent';
  const keychainHex = m[1].toUpperCase();
  const onDiskHex = await onDiskCaSha1Hex();
  if (!onDiskHex) return 'absent';
  return keychainHex === onDiskHex ? 'matching' : 'mismatch';
}

/** Adds the on-disk CA into the user's login keychain as a trusted root.
 *  No sudo, no osascript, no /tmp staging — `security add-trusted-cert`
 *  takes the cert path directly and SecurityAgent surfaces its own auth
 *  dialog (Touch ID friendly). Resolves cleanly on success; rejects with
 *  a bilingual message on user cancel or any other failure (callers turn
 *  that into the cert-error state).
 *
 *  Live-test (Bug B): the System Keychain path via osascript admin
 *  privileges fails from the menu-bar (LSUIElement) Electron context with
 *  "no user interaction was possible". User-domain trust sidesteps that
 *  entire class of failure — login keychain is owned by the running user
 *  and SecurityAgent honours UI requests from background-equivalent procs. */
export async function installCaToKeychain(): Promise<void> {
  try {
    await execFileP(
      'security',
      ['add-trusted-cert', '-r', 'trustRoot', '-k', LOGIN_KEYCHAIN, caCertPath()],
      { timeout: 60_000 },
    );
    await log('info', 'cert: CA installed into login keychain (user-domain trust)');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // SecurityAgent uses the same "User canceled" (one 'l') wording as the
    // old osascript admin dialog when the user dismisses, so the regex
    // carries over unchanged.
    if (/User canceled/i.test(msg)) {
      throw new Error('User cancelled the trust prompt / 已取消信任授权');
    }
    throw new Error(`Install failed / 安装失败: ${msg}`);
  }
}
