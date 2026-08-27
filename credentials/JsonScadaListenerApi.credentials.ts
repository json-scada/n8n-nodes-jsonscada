import {
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

// Credential for the N8N driver inbound HTTP listener (src/n8n-client), used by the
// action node's "Send Values" operation to push telemetry-style values into tags
// owned by an N8N connection. Basic auth matches the connection username/password.
export class JsonScadaListenerApi implements ICredentialType {
	name = 'jsonScadaListenerApi';

	displayName = 'JSON-SCADA N8N Listener API';

	icon: Icon = { light: 'file:jsonscada.svg', dark: 'file:jsonscada.dark.svg' };

	documentationUrl = 'https://github.com/riclolsen/json-scada/blob/master/src/n8n-client/README.md';

	properties: INodeProperties[] = [
		{
			displayName: 'Listener URL',
			name: 'listenerUrl',
			type: 'string',
			default: 'http://localhost:51930',
			placeholder: 'http://scada-host:51930',
			description: 'Base URL of the N8N driver inbound listener (ipAddressLocalBind of the N8N connection)',
			required: true,
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			description: 'Basic-auth username configured on the N8N connection',
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
			description: 'Whether to connect even when the listener TLS certificate cannot be validated (self-signed). Do not enable in production.',
		},
	];

	// "Test" posts an empty update batch to the listener: it exercises the URL
	// and the basic-auth pair without changing any point value.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.listenerUrl.replace(/\/+$/, "")}}',
			url: '/n8n/updates',
			method: 'POST',
			body: { points: [] },
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
			skipSslCertificateValidation: '={{$credentials.ignoreTlsIssues}}',
		},
	};
}
