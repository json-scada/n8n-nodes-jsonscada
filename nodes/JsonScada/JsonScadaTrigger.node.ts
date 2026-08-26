import {
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	INodeExecutionData,
	IDataObject,
	NodeConnectionType,
} from 'n8n-workflow';

// Webhook trigger that receives outbound notifications from the JSON-SCADA N8N
// driver (value changes, SOE events, integrity snapshots, heartbeats).
//
// Registration is manual: copy this node's Production Webhook URL into the N8N
// connection's "endpointURLs" in the JSON-SCADA AdminUI. If the connection sets a
// passphrase, enable "Require Bearer Token" here and paste the same token.
export class JsonScadaTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'JSON-SCADA Trigger',
		name: 'jsonScadaTrigger',
		icon: 'file:jsonscada.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["emitMode"]}}',
		description: 'Starts a workflow on JSON-SCADA value changes, SOE events, integrity snapshots or heartbeats',
		defaults: { name: 'JSON-SCADA Trigger' },
		inputs: [] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'jsonscada',
			},
		],
		properties: [
			{
				displayName:
					'Copy this node\'s Production Webhook URL into the N8N connection\'s "endpointURLs" in the JSON-SCADA AdminUI.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Emit Mode',
				name: 'emitMode',
				type: 'options',
				options: [
					{
						name: 'One Item Per Point/Event',
						value: 'perPoint',
						description: 'Split the incoming batch into one workflow item per point or event',
					},
					{
						name: 'One Item Per Batch',
						value: 'perBatch',
						description: 'Emit the whole envelope as a single item',
					},
				],
				default: 'perPoint',
			},
			{
				displayName: 'Notification Types',
				name: 'types',
				type: 'multiOptions',
				options: [
					{ name: 'Value Change', value: 'valueChange' },
					{ name: 'SOE Event', value: 'soeEvent' },
					{ name: 'Integrity Snapshot', value: 'integrity' },
					{ name: 'Heartbeat', value: 'heartbeat' },
				],
				default: ['valueChange', 'soeEvent'],
				description: 'Only these envelope types will start the workflow',
			},
			{
				displayName: 'Require Bearer Token',
				name: 'requireToken',
				type: 'boolean',
				default: false,
				description: 'Whether to reject requests that do not carry the matching Authorization: Bearer token (the connection passphrase)',
			},
			{
				displayName: 'Bearer Token',
				name: 'bearerToken',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				displayOptions: { show: { requireToken: [true] } },
				description: 'Must match the N8N connection passphrase',
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const body = req.body as IDataObject;

		// optional bearer token check
		const requireToken = this.getNodeParameter('requireToken', false) as boolean;
		if (requireToken) {
			const expected = this.getNodeParameter('bearerToken', '') as string;
			const auth = (req.headers['authorization'] as string) || '';
			if (auth !== 'Bearer ' + expected) {
				const res = this.getResponseObject();
				res.status(401).json({ error: 'invalid bearer token' });
				return { noWebhookResponse: true };
			}
		}

		const allowed = this.getNodeParameter('types', ['valueChange', 'soeEvent']) as string[];
		const type = (body?.type as string) || 'unknown';
		if (allowed.length > 0 && !allowed.includes(type)) {
			// acknowledge but do not start the workflow
			return { webhookResponse: { received: true, ignored: type } };
		}

		const emitMode = this.getNodeParameter('emitMode', 'perPoint') as string;
		const out: INodeExecutionData[] = [];

		if (emitMode === 'perBatch') {
			out.push({ json: body });
		} else {
			const envelopeMeta: IDataObject = {
				schema: body.schema,
				type: body.type,
				nodeName: body.nodeName,
				connectionNumber: body.connectionNumber,
				connectionName: body.connectionName,
				timestamp: body.timestamp,
			};
			const rows =
				(body.points as IDataObject[]) || (body.events as IDataObject[]) || null;
			if (rows && rows.length > 0) {
				for (const r of rows) out.push({ json: { ...envelopeMeta, ...r } });
			} else {
				out.push({ json: envelopeMeta });
			}
		}

		return {
			workflowData: [out],
			webhookResponse: { received: true },
		};
	}
}
