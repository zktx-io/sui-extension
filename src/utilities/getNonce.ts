/**
 * A helper function that returns a unique alphanumeric identifier called a nonce.
 *
 * @remarks This function is primarily used to help enforce content security
 * policies for resources/scripts being executed in a webview context.
 * Uses cryptographically secure random bytes for enhanced security.
 * Works in both Node.js and browser environments.
 *
 * @returns A nonce (base64 encoded random bytes)
 */
export const getNonce = () => {
  // Check if running in Node.js environment
  if (typeof process !== 'undefined' && process.versions?.node) {
    // Node.js environment - use crypto module
    const { randomBytes } = require('crypto');
    return randomBytes(16).toString('base64');
  } else {
    // Browser environment - use Web Crypto API
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }
};
