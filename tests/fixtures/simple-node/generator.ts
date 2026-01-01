// pattern: Functional Core

import { containerfile, from, workdir, copy, run, expose, cmd } from '../../../src/index.js';

export const fixture = containerfile({
  instructions: [
    from('node:20-alpine'),
    workdir('/app'),
    copy('package*.json', '.'),
    run('npm ci'),
    copy('.', '.'),
    expose(3000),
    cmd(['node', 'dist/index.js']),
  ],
});
