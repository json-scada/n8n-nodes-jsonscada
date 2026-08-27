import {
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

// Credential for the JSON-SCADA realtime/auth web API (POST /Invoke), used by the
// action node for reads, browse, history, commands and alarm/event acknowledgement.
// Authentication is a username/password login that yields an x-access-token JWT;
// the login flow is handled in GenericFunctions (not a static header), so this
// credential only stores the connection parameters.
export class JsonScadaApi implements ICredentialType {
	name = 'jsonScadaApi';

	displayName = 'JSON-SCADA API';

	icon: Icon = { light: 'file:jsonscada.svg', dark: 'file:jsonscada.dark.svg' };

	documentationUrl = 'https://github.com/json-scada/n8n-nodes-jsonscada/README.md';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://localhost:8080',
			placeholder: 'https://scada.example.com',
			description: 'Base URL of the JSON-SCADA server_realtime_auth web server (no trailing /Invoke)',
			required: true,
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			description: 'JSON-SCADA user for the automation account (create a dedicated role, e.g. with sendCommands / ackAlarms / ackEvents rights and a group1List scope)',
			required: true,
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: 'Ignore TLS Certificate Issues',
			name: 'ignoreTlsIssues',
			type: 'boolean',
			default: false,
			description: 'Whether to connect even when the server TLS certificate cannot be validated (self-signed). Do not enable in production.',
		},
	];

	// "Test" in the credential dialog performs the same signin the node does at
	// runtime. The server answers 200 with { ok: false, message } for bad
	// credentials, so the failure has to be detected from the body, not the status.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\/+$/, "")}}',
			url: '/Invoke/auth/signin',
			method: 'POST',
			body: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
			skipSslCertificateValidation: '={{$credentials.ignoreTlsIssues}}',
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'ok',
					value: false,
					message: 'JSON-SCADA rejected the login: check the base URL, username and password',
				},
			},
		],
	};
}
