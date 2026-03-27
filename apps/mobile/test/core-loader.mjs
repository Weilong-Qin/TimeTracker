import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const coreEntryUrl = pathToFileURL(
  path.resolve(__dirname, '../../../packages/core/.tmp-test-mobile/src/index.js'),
).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@timetracker/core') {
    return {
      url: coreEntryUrl,
      shortCircuit: true,
    };
  }

  return nextResolve(specifier, context);
}
