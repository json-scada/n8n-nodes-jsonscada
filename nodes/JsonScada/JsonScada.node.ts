import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	Icon,
	JsonObject,
	NodeApiError,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import {
	readValues,
	browse,
	issueCommand,
	writeAck,
	sendValues,
} from './GenericFunctions';

import { OpcAcknowledge } from './OpcCodes';

export class JsonScada implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'JSON-SCADA',
		name: 'jsonScada',
		icon: { light: 'file:jsonscada.svg', dark: 'file:jsonscada.dark.svg' } as Icon,
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read/write JSON-SCADA: values, commands, alarm/event acknowledgement, browse and value push',
		defaults: { name: 'JSON-SCADA' },
		usableAsTool: true,
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],
		credentials: [
			{
				name: 'jsonScadaApi',
				required: true,
				displayOptions: {
					show: { resource: ['tag', 'command', 'alarm'] },
				},
			},
			{
				name: 'jsonScadaListenerApi',
				required: true,
				displayOptions: {
					show: { resource: ['data'] },
				},
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Tag', value: 'tag' },
					{ name: 'Command', value: 'command' },
					{ name: 'Alarm / Event', value: 'alarm' },
					{ name: 'Data (Push to Driver)', value: 'data' },
				],
				default: 'tag',
			},

			// ---- Tag operations ----
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['tag'] } },
				options: [
					{
						name: 'Read Values',
						value: 'readValues',
						description: 'Read current values for a list of tags or point keys',
						action: 'Read values',
					},
					{
						name: 'Browse',
						value: 'browse',
						description: 'List distinct group1 / group2 / group3 values',
						action: 'Browse the point database',
					},
				],
				default: 'readValues',
			},
			{
				displayName: 'Tags or Point Keys',
				name: 'tags',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'KAW2AL-21MTWT, 1234',
				description: 'Comma-separated list of tag names or numeric point keys',
				displayOptions: { show: { resource: ['tag'], operation: ['readValues'] } },
			},
			{
				displayName: 'Browse Attribute',
				name: 'browseAttribute',
				type: 'options',
				options: [
					{ name: 'Group1 (Station)', value: 'group1' },
					{ name: 'Group2 (Bay)', value: 'group2' },
					{ name: 'Group3', value: 'group3' },
				],
				default: 'group1',
				displayOptions: { show: { resource: ['tag'], operation: ['browse'] } },
			},

			// ---- Command operations ----
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['command'] } },
				options: [
					{
						name: 'Issue Command',
						value: 'issueCommand',
						description: 'Send a command / setpoint to a command point',
						action: 'Issue a command',
					},
				],
				default: 'issueCommand',
			},
			{
				displayName: 'Command Point Key',
				name: 'pointKey',
				type: 'number',
				default: 0,
				required: true,
				description: 'Numeric point key (_id) of the command point',
				displayOptions: { show: { resource: ['command'], operation: ['issueCommand'] } },
			},
			{
				displayName: 'Value',
				name: 'commandValue',
				type: 'string',
				default: '1',
				required: true,
				description: 'Command value (numeric for most commands; use String type for string setpoints)',
				displayOptions: { show: { resource: ['command'], operation: ['issueCommand'] } },
			},
			{
				displayName: 'Value Is String',
				name: 'commandIsString',
				type: 'boolean',
				default: false,
				description: 'Whether to send the value as a string setpoint instead of a number',
				displayOptions: { show: { resource: ['command'], operation: ['issueCommand'] } },
			},

			// ---- Alarm / Event operations ----
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['alarm'] } },
				options: [
					{
						name: 'Acknowledge',
						value: 'acknowledge',
						description: 'Acknowledge or remove alarms/events on a point',
						action: 'Acknowledge alarms or events',
					},
				],
				default: 'acknowledge',
			},
			{
				displayName: 'Tag or Point Key',
				name: 'ackTarget',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['alarm'], operation: ['acknowledge'] } },
			},
			{
				displayName: 'Action',
				name: 'ackAction',
				type: 'options',
				options: [
					{ name: 'Acknowledge All Alarms', value: 'ackAllAlarms' },
					{ name: 'Acknowledge All Events', value: 'ackAllEvents' },
					{ name: 'Acknowledge Point Alarms', value: 'ackOneAlarm' },
					{ name: 'Acknowledge Point Events', value: 'ackPointEvents' },
					{ name: 'Remove Point Events', value: 'removePointEvents' },
					{ name: 'Silence Beep', value: 'silenceBeep' },
				],
				default: 'ackOneAlarm',
				displayOptions: { show: { resource: ['alarm'], operation: ['acknowledge'] } },
			},

			// ---- Data push operations ----
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['data'] } },
				options: [
					{
						name: 'Send Values',
						value: 'sendValues',
						description: 'Push values into tags owned by an N8N connection (auto-created when enabled)',
						action: 'Send values to the driver',
					},
				],
				default: 'sendValues',
			},
			{
				displayName: 'Points',
				name: 'points',
				placeholder: 'Add Point',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: { show: { resource: ['data'], operation: ['sendValues'] } },
				options: [
					{
						name: 'point',
						displayName: 'Point',
						values: [
							{ displayName: 'Tag', name: 'tag', type: 'string', default: '' },
							{ displayName: 'Value', name: 'value', type: 'string', default: '' },
							{ displayName: 'Invalid', name: 'invalid', type: 'boolean', default: false },
							{ displayName: 'Time (ISO, Optional)', name: 'timeTagAtSource', type: 'string', default: '' },
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'tag' && operation === 'readValues') {
					const raw = String(this.getNodeParameter('tags', i) ?? '');
					const list = raw.split(',').map((s) => s.trim()).filter((s) => s !== '');
					const points = await readValues(this, list);
					for (const p of points) returnData.push({ json: p, pairedItem: { item: i } });
				} else if (resource === 'tag' && operation === 'browse') {
					const attr = this.getNodeParameter('browseAttribute', i) as 'group1' | 'group2' | 'group3';
					const values = await browse(this, attr);
					for (const v of values) returnData.push({ json: { attribute: attr, value: v }, pairedItem: { item: i } });
				} else if (resource === 'command' && operation === 'issueCommand') {
					const pointKey = this.getNodeParameter('pointKey', i) as number;
					const isString = this.getNodeParameter('commandIsString', i) as boolean;
					const rawVal = this.getNodeParameter('commandValue', i) as string;
					const value: number | string = isString ? rawVal : parseFloat(rawVal);
					if (!isString && isNaN(value as number))
						throw new NodeOperationError(this.getNode(), 'Command value is not a number', { itemIndex: i });
					const ok = await issueCommand(this, pointKey, value, isString);
					returnData.push({ json: { pointKey, value, ok }, pairedItem: { item: i } });
				} else if (resource === 'alarm' && operation === 'acknowledge') {
					const target = this.getNodeParameter('ackTarget', i) as string;
					const actionName = this.getNodeParameter('ackAction', i) as string;
					const action = ackActionCode(actionName);
					await writeAck(this, target, action);
					returnData.push({ json: { target, action: actionName, ok: true }, pairedItem: { item: i } });
				} else if (resource === 'data' && operation === 'sendValues') {
					const coll = this.getNodeParameter('points', i) as IDataObject;
					const rows = (coll.point as IDataObject[]) || [];
					const points: IDataObject[] = rows.map((r) => {
						const out: IDataObject = {
							tag: r.tag,
							value: coerceValue(r.value),
							invalid: r.invalid === true || r.invalid === 'true',
						};
						if (r.timeTagAtSource && String(r.timeTagAtSource).trim() !== '')
							out.timeTagAtSource = r.timeTagAtSource;
						return out;
					});
					const res = await sendValues(this, points);
					returnData.push({ json: res, pairedItem: { item: i } });
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported operation ${resource}:${operation}`, { itemIndex: i });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// Surface everything through NodeApiError so the n8n UI keeps the HTTP
				// context; the explicit message preserves our own validation wording.
				throw new NodeApiError(this.getNode(), error as JsonObject, {
					message: (error as Error).message,
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}

function ackActionCode(name: string): number {
	switch (name) {
		case 'ackPointEvents':
			return OpcAcknowledge.AckPointEvents;
		case 'removePointEvents':
			return OpcAcknowledge.RemovePointEvents;
		case 'ackAllAlarms':
			return OpcAcknowledge.AckAllAlarms;
		case 'ackAllEvents':
			return OpcAcknowledge.AckAllEvents;
		case 'silenceBeep':
			return OpcAcknowledge.SilenceBeep;
		case 'ackOneAlarm':
		default:
			return OpcAcknowledge.AckOneAlarm;
	}
}

// The Value field is declared as a string parameter, but an expression bound to it
// resolves to whatever the incoming item holds - a number, a boolean, null, even an
// object - and n8n passes that through untouched. So normalize whatever arrives:
// numbers and booleans go through as they are, "true"/"false" and numeric text are
// parsed, and everything else ends up a string.
function coerceValue(v: unknown): number | string | boolean {
	if (typeof v === 'number' || typeof v === 'boolean') return v;
	if (v === null || v === undefined) return '';
	if (typeof v !== 'string') return JSON.stringify(v);
	if (v === 'true') return true;
	if (v === 'false') return false;
	if (v.trim() !== '' && !isNaN(Number(v))) return Number(v);
	return v;
}
