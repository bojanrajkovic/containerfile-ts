// pattern: Functional Core

import { containerfile, stage, from, workdir, copy, run, cmd } from '../../../src/index.js';

export const fixture = containerfile({
  stages: [
    stage('builder', [
      from('node:20', { as: 'builder' }),
      workdir('/app'),
      copy('package*.json', '.'),
      run('npm ci'),
      copy('.', '.'),
      run('npm run build'),
    ]),
    stage('runtime', [
      from('node:20-alpine', { as: 'runtime' }),
      workdir('/app'),
      copy('/app/dist', './dist', { from: 'builder' }),
      copy('/app/node_modules', './node_modules', { from: 'builder' }),
      cmd(['node', 'dist/index.js']),
    ]),
  ],
});
