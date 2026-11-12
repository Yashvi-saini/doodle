import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import root from '../../eslint.config.mjs';

export default defineConfig(root, {
  files: ['**/*.{ts,tsx}'],
  extends: [reactHooks.configs.flat['recommended-latest']],
});
