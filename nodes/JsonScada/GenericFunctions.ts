import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	IN8nHttpFullResponse,
	JsonObject,
	NodeApiError,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';

import {
	OpcServiceCode,
	OpcStatusCodes,
	OpcAttributeId,
} from './OpcCodes';

type Ctx = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;

// Cache of JWTs keyed by baseUrl|username so repeated executions reuse the login.
const tokenCache: Map<string, string> = new Map();

let handleSeq = 1;
function newHandle(): number {
	handleSeq = (handleSeq % 2000000000) + 1;
	return handleSeq;
}

function cacheKey(baseUrl: string, username: string): string {
	return baseUrl + '|' + username;
}

// Perform the JSON-SCADA signin and capture the x-access-token cookie value.
async function login(ctx: Ctx, baseUrl: string, username: string, password: string, ignoreTls: boolean): Promise<string> {
	const options: IHttpRequestOptions = {
		method: 'POST' as IHttpRequestMethods,
		url: baseUrl.replace(/\/+$/, '') + '/Invoke/auth/signin',
		body: { username, password },
		returnFullResponse: true,
		skipSslCertificateValidation: ignoreTls,
	};
	const response = (await ctx.helpers.httpRequest(options)) as IN8nHttpFullResponse;
	const body = response.body as IDataObject;
	if (!body || body.ok !== true) {
		throw new NodeApiError(ctx.getNode(), (body as unknown as JsonObject) ?? {}, {
			message: 'JSON-SCADA login failed: ' + ((body && body.message) || 'unknown error'),
		});
	}
	// extract x-access-token from Set-Cookie
	const setCookie = response.headers['set-cookie'] as string[] | undefined;
	let token = '';
	if (Array.isArray(setCookie)) {
		for (const c of setCookie) {
			const m = /x-access-token=([^;]+)/.exec(c);
			if (m && m[1] && m[1] !== 'null') {
				token = m[1];
				break;
			}
		}
	}
	if (!token) {
		throw new NodeApiError(ctx.getNode(), {}, {
			message: 'JSON-SCADA login did not return an access token',
		});
	}
	tokenCache.set(cacheKey(baseUrl, username), token);
	return token;
}

// Read the JSON-SCADA API credential and return a normalized config.
async function getApiConfig(ctx: Ctx) {
	const cred = await ctx.getCredentials('jsonScadaApi');
	return {
		baseUrl: (cred.baseUrl as string).replace(/\/+$/, ''),
		username: cred.username as string,
		password: cred.password as string,
		ignoreTls: cred.ignoreTlsIssues === true,
	};
}

// POST an OPC envelope to /Invoke with the cached token; re-login once on auth failure.
export async function invoke(ctx: Ctx, request: IDataObject, timeoutMs = 5000): Promise<IDataObject> {
	const cfg = await getApiConfig(ctx);
	const key = cacheKey(cfg.baseUrl, cfg.username);
	let token = tokenCache.get(key);
	if (!token) token = await login(ctx, cfg.baseUrl, cfg.username, cfg.password, cfg.ignoreTls);

	const doPost = async (tok: string): Promise<IDataObject> => {
		const options: IHttpRequestOptions = {
			method: 'POST' as IHttpRequestMethods,
			url: cfg.baseUrl + '/Invoke',
			headers: { 'x-access-token': tok },
			body: request,
			timeout: timeoutMs + 2000,
			skipSslCertificateValidation: cfg.ignoreTls,
		};
		return (await ctx.helpers.httpRequest(options)) as IDataObject;
	};

	let data = await doPost(token);
	if (isAuthFailure(data)) {
		// token likely expired/invalid — re-login once
		token = await login(ctx, cfg.baseUrl, cfg.username, cfg.password, cfg.ignoreTls);
		data = await doPost(token);
	}
	return data;
}

function isAuthFailure(data: IDataObject): boolean {
	const sr = (((data.Body as IDataObject) || {}).ResponseHeader as IDataObject || {}).ServiceResult as number;
	return (
		sr === OpcStatusCodes.BadUserAccessDenied ||
		sr === OpcStatusCodes.BadIdentityTokenInvalid ||
		sr === OpcStatusCodes.BadIdentityTokenRejected
	);
}

function requestHeader(handle: number, timeoutHint: number): IDataObject {
	return {
		Timestamp: new Date().toISOString(),
		RequestHandle: handle,
		TimeoutHint: timeoutHint,
		ReturnDiagnostics: 2,
		AuthenticationToken: null,
	};
}

// ---- high-level helpers used by the node ----

// Read current values for a list of tags or numeric point keys.
export async function readValues(ctx: Ctx, keysOrTags: string[]): Promise<IDataObject[]> {
	if (keysOrTags.length === 0) return [];
	const handle = newHandle();
	const nodesToRead = keysOrTags.map((el) => {
		const numeric = !isNaN(parseInt(el, 10)) && String(parseInt(el, 10)) === String(el).trim();
		return {
			NodeId: {
				IdType: numeric ? 0 : 1,
				Id: numeric ? parseInt(el, 10) : el,
				Namespace: 2,
			},
			AttributeId: OpcAttributeId.Value,
		};
	});
	const req: IDataObject = {
		ServiceId: OpcServiceCode.ReadRequest,
		Body: {
			RequestHeader: requestHeader(handle, 3000),
			MaxAge: 0,
			TimestampsToReturn: 2,
			NodesToRead: nodesToRead,
		},
	};
	const data = await invoke(ctx, req, 3000);
	assertOk(ctx, data, [OpcServiceCode.ReadResponse]);
	const results = (((data.Body as IDataObject) || {}).Results as IDataObject[]) || [];
	return results.map((el) => simplifyReadResult(el));
}

// Browse distinct group1 / group2 / group3 values.
export async function browse(ctx: Ctx, attribute: 'group1' | 'group2' | 'group3'): Promise<string[]> {
	const attrId =
		attribute === 'group2'
			? OpcAttributeId.ExtendedGroup2
			: attribute === 'group3'
			? OpcAttributeId.ExtendedGroup3
			: OpcAttributeId.ExtendedGroup1;
	const handle = newHandle();
	const req: IDataObject = {
		ServiceId: OpcServiceCode.Extended_RequestUniqueAttributeValues,
		Body: {
			RequestHeader: requestHeader(handle, 3000),
			AttributeId: attrId,
		},
	};
	const data = await invoke(ctx, req, 3000);
	assertOk(ctx, data, [OpcServiceCode.Extended_ResponseUniqueAttributeValues]);
	const results = (((data.Body as IDataObject) || {}).Results as IDataObject[]) || [];
	const list: string[] = [];
	for (const el of results) {
		const v = ((el.Value as IDataObject) || {}).Body;
		if (v !== null && v !== undefined && v !== '') list.push(String(v));
	}
	return list;
}

// Issue a command / setpoint to a command point key.
export async function issueCommand(ctx: Ctx, pointKey: number, value: number | string, isString: boolean): Promise<boolean> {
	const handle = newHandle();
	const req: IDataObject = {
		ServiceId: OpcServiceCode.WriteRequest,
		Body: {
			RequestHeader: requestHeader(handle, 2000),
			NodesToWrite: [
				{
					NodeId: { IdType: 0, Id: pointKey, Namespace: 2 },
					AttributeId: OpcAttributeId.Value,
					Value: { Type: isString ? 12 : 11, Body: value },
				},
			],
		},
	};
	const data = await invoke(ctx, req, 2000);
	assertOk(ctx, data, [OpcServiceCode.WriteResponse]);
	const results = (((data.Body as IDataObject) || {}).Results as number[]) || [];
	return Array.isArray(results) && results[0] === OpcStatusCodes.Good;
}

// Acknowledge / remove alarms or events on a point (action = OpcAcknowledge bitmask).
export async function writeAck(ctx: Ctx, pointKeyOrTag: string | number, action: number): Promise<boolean> {
	const handle = newHandle();
	const asStr = String(pointKeyOrTag);
	const numeric = !isNaN(parseInt(asStr, 10)) && String(parseInt(asStr, 10)) === asStr.trim();
	const req: IDataObject = {
		ServiceId: OpcServiceCode.WriteRequest,
		Body: {
			RequestHeader: requestHeader(handle, 2000),
			NodesToWrite: [
				{
					NodeId: {
						IdType: numeric ? 0 : 1,
						Id: numeric ? parseInt(asStr, 10) : asStr,
						Namespace: 2,
					},
					AttributeId: OpcAttributeId.ExtendedAlarmEventsAck,
					Value: { Type: 27, Body: action },
				},
			],
		},
	};
	const data = await invoke(ctx, req, 2000);
	assertOk(ctx, data, [OpcServiceCode.WriteResponse]);
	return true;
}

// Send values into the N8N driver listener (the B1 "SCADA as data source" path).
export async function sendValues(ctx: IExecuteFunctions, points: IDataObject[]): Promise<IDataObject> {
	const cred = await ctx.getCredentials('jsonScadaListenerApi');
	const listenerUrl = (cred.listenerUrl as string).replace(/\/+$/, '');
	const auth = Buffer.from((cred.username as string) + ':' + (cred.password as string)).toString('base64');
	const options: IHttpRequestOptions = {
		method: 'POST' as IHttpRequestMethods,
		url: listenerUrl + '/n8n/updates',
		headers: { Authorization: 'Basic ' + auth },
		body: { points },
		skipSslCertificateValidation: cred.ignoreTlsIssues === true,
	};
	return (await ctx.helpers.httpRequest(options)) as IDataObject;
}

// ---- result shaping ----

function simplifyReadResult(el: IDataObject): IDataObject {
	const value = (el.Value as IDataObject) || {};
	const props = (el._Properties as IDataObject) || {};
	const nodeId = (el.NodeId as IDataObject) || {};
	return {
		tag: nodeId.Id,
		pointKey: props._id,
		value: value.Body,
		quality: value.Quality,
		good: value.Quality === OpcStatusCodes.Good,
		type: props.type,
		group1: props.group1,
		group2: props.group2,
		description: props.description,
		unit: props.unit,
		invalid: props.invalid,
		alarmed: props.alarmed,
		sourceTimestamp: el.SourceTimestamp,
		serverTimestamp: el.ServerTimestamp,
	};
}

function assertOk(ctx: Ctx, data: IDataObject, expectServiceIds: number[]): void {
	const serviceId = data.ServiceId as number;
	const body = (data.Body as IDataObject) || {};
	const header = (body.ResponseHeader as IDataObject) || {};
	const sr = header.ServiceResult as number;
	if (serviceId === OpcServiceCode.ServiceFault || !expectServiceIds.includes(serviceId)) {
		throw new NodeApiError(ctx.getNode(), data as unknown as JsonObject, {
			message: 'JSON-SCADA service fault (ServiceId ' + serviceId + ', ServiceResult 0x' + (sr >>> 0).toString(16) + ')',
		});
	}
	if (sr !== OpcStatusCodes.Good && sr !== OpcStatusCodes.GoodNoData && sr !== OpcStatusCodes.GoodMoreData) {
		throw new NodeApiError(ctx.getNode(), data as unknown as JsonObject, {
			message: 'JSON-SCADA request not Good (ServiceResult 0x' + (sr >>> 0).toString(16) + ')',
		});
	}
}
