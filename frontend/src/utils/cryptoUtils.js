const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;

function getSubtleCrypto() {
  if (!window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  return window.crypto.subtle;
}

function toBase64(bytes) {
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toSaltBytes(salt) {
  if (typeof salt === 'string') {
    return new TextEncoder().encode(salt);
  }

  return new Uint8Array(salt);
}

export async function deriveKey(masterPassword, salt) {
  if (typeof masterPassword !== 'string' || !masterPassword) {
    throw new Error('Master password is required');
  }

  const subtle = getSubtleCrypto();
  const saltBytes = toSaltBytes(salt);

  if (saltBytes.length === 0) {
    throw new Error('Salt is required');
  }

  const passwordKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(plaintext, key) {
  if (typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a string');
  }

  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await getSubtleCrypto().encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
  };
}

export async function decrypt(ciphertext, key, iv) {
  const decrypted = await getSubtleCrypto().decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}