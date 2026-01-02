// pattern: Functional Core

import {
  containerfile,
  stage,
  from,
  workdir,
  copy,
  run,
  cmd,
} from '../../../src/index.js';

/**
 * Multi-stage build fixture that exercises:
 * - containerfile with `stages` property (not `instructions`)
 * - stage() factory function to create named stages
 * - FROM with AS alias for stage naming
 * - COPY --from to copy artifacts between stages
 * - Rendering with double newline separators between stages
 */
export const fixture = containerfile({
  stages: [
    stage('builder', [
      from('node:20-alpine', { as: 'builder' }),
      workdir('/app'),
      copy('package*.json', '.'),
      run('npm ci'),
      copy('.', '.'),
      run('npm run build'),
    ]),
    stage('production', [
      from('node:20-alpine'),
      workdir('/app'),
      copy('package*.json', '.'),
      run('npm ci --omit=dev'),
      copy('dist/', './dist/', { from: 'builder' }),
      cmd(['node', 'dist/index.js']),
    ]),
  ],
});
