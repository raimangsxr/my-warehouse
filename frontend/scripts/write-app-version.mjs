import { writeFileSync } from 'node:fs';

const version = process.env.APP_VERSION ?? 'dev';

writeFileSync(
  'src/app/core/app-version.ts',
  `/** Injected at image build time. Local dev and tests use the checked-in default. */\nexport const APP_VERSION = ${JSON.stringify(version)};\n`
);
