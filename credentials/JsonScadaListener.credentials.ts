import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

// Credential for the N8N driver inbound HTTP listener (src/n8n-client), used by the
// action node's "Send Values" operation to push telemetry-style values into tags
// owned by an N8N connection. Basic auth matches the connection username/password.
export class JsonScadaListener implements ICredentialType {
	name = 'jsonScadaListener';

	displayName = 'JSON-SCADA N8N Listener';

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
		},
	];
}
