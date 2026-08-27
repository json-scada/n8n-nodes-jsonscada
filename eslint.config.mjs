// Mirrors the flat config used by `npx @n8n/scan-community-package`, so that
// `npm run lint` reproduces the n8n community-node publishing gate locally
// instead of only finding out after publishing to npm.
//
// Kept deliberately in sync with buildScanConfig() in
// @n8n/scan-community-package/scanner/scanner.mjs. When bumping
// @n8n/eslint-plugin-community-nodes or eslint-plugin-n8n-nodes-base, check
// that scanner's dependency versions still match this package's devDependencies.
import { defineConfig, globalIgnores } from 'eslint/config';
import { n8nCommunityNodesPlugin } from '@n8n/eslint-plugin-community-nodes';
import n8nNodesPlugin from 'eslint-plugin-n8n-nodes-base';
import tsParser from '@typescript-eslint/parser';

export default defineConfig(
	globalIgnores(['dist/**', 'node_modules/**', 'gulpfile.cjs', 'index.js', 'package-lock.json']),
	n8nCommunityNodesPlugin.configs.recommended,
	{
		rules: { 'no-console': 'error' },
	},
	{ plugins: { 'n8n-nodes-base': n8nNodesPlugin } },
	{
		files: ['package.json'],
		rules: { ...n8nNodesPlugin.configs.community.rules },
	},
	{
		files: ['**/credentials/**/*.ts'],
		rules: {
			...n8nNodesPlugin.configs.credentials.rules,
			// Not valid for community nodes
			'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			// @n8n/eslint-plugin-community-nodes credential-password-field rule is more accurate
			'n8n-nodes-base/cred-class-field-type-options-password-missing': 'off',
		},
	},
	{
		files: ['**/nodes/**/*.ts'],
		rules: {
			...n8nNodesPlugin.configs.nodes.rules,
			// Inputs and outputs can be enum instead of string "main"
			'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
			'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
			// Sometimes the 3rd party API does have a maximum limit, so maxValue is valid
			'n8n-nodes-base/node-param-type-options-max-value-present': 'off',
		},
	},
	{
		files: ['**/*.json'],
		languageOptions: { parser: tsParser },
	},
	{
		files: ['**/*.ts'],
		languageOptions: { parser: tsParser },
	},
);
