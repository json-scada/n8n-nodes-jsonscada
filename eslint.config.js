import n8nNodesBase from 'eslint-plugin-n8n-nodes-base';
import tsParser from '@typescript-eslint/parser';
import jsonParser from 'eslint-plugin-json/dist/parser.mjs';

export default [
	{
		ignores: ['**/*.js', '**/node_modules/**', '**/dist/**'],
	},
	{
		files: ['package.json'],
		languageOptions: {
			parser: jsonParser,
		},
		plugins: {
			'n8n-nodes-base': n8nNodesBase,
		},
		rules: {
			'n8n-nodes-base/community-package-json-name-still-default': 'off',
		},
	},
	{
		files: ['./credentials/**/*.ts', './nodes/**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				sourceType: 'module',
				extraFileExtensions: ['.json'],
				ecmaVersion: 2022,
			},
			globals: {
				browser: true,
				es6: true,
				node: true,
			},
		},
		plugins: {
			'n8n-nodes-base': n8nNodesBase,
		},
		rules: {
			'n8n-nodes-base/node-execute-block-missing-continue-on-fail': 'off',
			'n8n-nodes-base/node-resource-description-filename-against-convention': 'off',
		},
	},
];
