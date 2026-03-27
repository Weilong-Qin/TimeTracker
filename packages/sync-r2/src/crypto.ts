const ENCRYPTED_PAYLOAD_PREFIX = 'ttsync-enc-v1:';
const DEFAULT_PBKDF2_ITERATIONS = 210_000;
const AES_GCM_IV_LENGTH = 12;
const SALT_LENGTH = 16;

interface EncryptedPayloadEnvelopeV1 {
  version: 1;
  algorithm: 'AES-GCM-256';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  saltHex: string;
  ivHex: string;
  cipherHex: string;
}

export interface SyncEncryptionOptions {
  passphrase: string;
  pbkdf2Iterations?: number;
}

interface SubtleCryptoLike {
  importKey(
    format: string,
    keyData: Uint8Array,
    algorithm: string,
    extractable: boolean,
    keyUsages: string[],
  ): Promise<unknown>;
  deriveKey(
    algorithm: {
      name: string;
      hash: string;
      salt: Uint8Array;
      iterations: number;
    },
    baseKey: unknown,
    derivedKeyType: {
      name: string;
      length: number;
    },
    extractable: boolean,
    keyUsages: string[],
  ): Promise<unknown>;
  encrypt(
    algorithm: {
      name: string;
      iv: Uint8Array;
    },
    key: unknown,
    data: Uint8Array,
  ): Promise<ArrayBuffer>;
  decrypt(
    algorithm: {
      name: string;
      iv: Uint8Array;
    },
    key: unknown,
    data: Uint8Array,
  ): Promise<ArrayBuffer>;
}

interface RuntimeCryptoLike {
  subtle: SubtleCryptoLike;
  getRandomValues(array: Uint8Array): Uint8Array;
}

function getCrypto(): RuntimeCryptoLike {
  const runtimeCrypto = (globalThis as { crypto?: RuntimeCryptoLike }).crypto;
  if (!runtimeCrypto || !runtimeCrypto.subtle) {
    throw new Error('Web Crypto API is unavailable in this runtime');
  }
  return runtimeCrypto;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error('Invalid hex payload');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}

function normalizeIterations(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 10_000) {
    return DEFAULT_PBKDF2_ITERATIONS;
  }
  return Math.floor(value);
}

function normalizePassphrase(value: string | undefined): string {
  if (!value) {
    return '';
  }
  return value.trim();
}

async function deriveEncryptionKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<unknown> {
  const cryptoApi = getCrypto();
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

function isEncryptedEnvelope(raw: string): boolean {
  return raw.startsWith(ENCRYPTED_PAYLOAD_PREFIX);
}

function parseEncryptedEnvelope(raw: string): EncryptedPayloadEnvelopeV1 {
  if (!isEncryptedEnvelope(raw)) {
    throw new Error('Payload is not an encrypted envelope');
  }

  const encoded = raw.slice(ENCRYPTED_PAYLOAD_PREFIX.length);
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    throw new Error('Invalid encrypted payload envelope JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid encrypted payload envelope');
  }

  const envelope = parsed as Partial<EncryptedPayloadEnvelopeV1>;
  if (
    envelope.version !== 1 ||
    envelope.algorithm !== 'AES-GCM-256' ||
    envelope.kdf !== 'PBKDF2-SHA256' ||
    typeof envelope.iterations !== 'number' ||
    envelope.iterations < 10_000 ||
    typeof envelope.saltHex !== 'string' ||
    typeof envelope.ivHex !== 'string' ||
    typeof envelope.cipherHex !== 'string'
  ) {
    throw new Error('Invalid encrypted payload envelope fields');
  }

  return envelope as EncryptedPayloadEnvelopeV1;
}

export function isEncryptedSyncPayload(raw: string): boolean {
  return isEncryptedEnvelope(raw);
}

export async function encryptSyncPayload(
  plainText: string,
  options: SyncEncryptionOptions,
): Promise<string> {
  const passphrase = normalizePassphrase(options.passphrase);
  if (!passphrase) {
    throw new Error('Encryption passphrase is required');
  }

  const iterations = normalizeIterations(options.pbkdf2Iterations);
  const cryptoApi = getCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = cryptoApi.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const key = await deriveEncryptionKey(passphrase, salt, iterations);

  const cipherBuffer = await cryptoApi.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    new TextEncoder().encode(plainText),
  );

  const envelope: EncryptedPayloadEnvelopeV1 = {
    version: 1,
    algorithm: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations,
    saltHex: toHex(salt),
    ivHex: toHex(iv),
    cipherHex: toHex(new Uint8Array(cipherBuffer)),
  };

  return `${ENCRYPTED_PAYLOAD_PREFIX}${JSON.stringify(envelope)}`;
}

export async function decryptSyncPayload(
  encryptedPayload: string,
  options: SyncEncryptionOptions,
): Promise<string> {
  const passphrase = normalizePassphrase(options.passphrase);
  if (!passphrase) {
    throw new Error('Encryption passphrase is required');
  }

  const envelope = parseEncryptedEnvelope(encryptedPayload);
  const salt = fromHex(envelope.saltHex);
  const iv = fromHex(envelope.ivHex);
  const cipher = fromHex(envelope.cipherHex);
  const key = await deriveEncryptionKey(passphrase, salt, envelope.iterations);

  try {
    const plainBuffer = await getCrypto().subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      cipher,
    );
    return new TextDecoder().decode(plainBuffer);
  } catch {
    throw new Error('Failed to decrypt sync payload (wrong key or corrupted payload)');
  }
}

export function resolveEncryptionOptions(
  input: SyncEncryptionOptions | undefined,
): SyncEncryptionOptions | null {
  if (!input) {
    return null;
  }

  const passphrase = normalizePassphrase(input.passphrase);
  if (!passphrase) {
    return null;
  }

  return {
    passphrase,
    pbkdf2Iterations: normalizeIterations(input.pbkdf2Iterations),
  };
}
