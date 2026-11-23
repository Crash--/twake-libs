// Node-only barrel - helpers that require `node:crypto` because no equivalent
// exists in the Web Crypto API. Import from this subpath instead of the main
// entry to make the Node dependency explicit at consumer call sites:
//
//     import { generateScryptHash } from '@linagora/twake-crypto-utils/node';
//
// Runtimes that implement `node:crypto` (Node, Bun, Deno with `--node-compat`)
// can consume this entry. Browsers cannot; importing it from browser-bundled
// code will fail at build time, which is the intended behaviour.

export {
  marshalScryptText,
  unmarshalScryptText,
  generateScryptHash,
  extractScryptParameters
} from './scrypt.js'
