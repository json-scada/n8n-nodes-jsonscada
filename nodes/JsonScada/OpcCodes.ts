// Minimal OPC Web-HMI code set used to speak the JSON-SCADA /Invoke protocol.
// Mirrors src/AdminUI/src/lib/opcCodes.js (kept self-contained so the npm package
// has no dependency on the JSON-SCADA source tree).

export const OpcNamespaceMongodb = 2;

export const OpcStatusCodes = {
	Good: 0,
	GoodNoData: 0x00a50000,
	GoodMoreData: 0x00a60000,
	BadUserAccessDenied: 0x801f0000,
	BadIdentityTokenInvalid: 0x80200000,
	BadIdentityTokenRejected: 0x80210000,
};

export const TimestampsToReturn = {
	Source: 0,
	Server: 1,
	Both: 2,
	Neither: 3,
};

export const OpcValueTypes = {
	Boolean: 1,
	Double: 11,
	String: 12,
	Integer: 27,
};

export const OpcKeyType = {
	Numeric: 0,
	String: 1,
};

export const OpcServiceCode = {
	ServiceFault: 395,
	ReadRequest: 629,
	ReadResponse: 632,
	HistoryReadRequest: 662,
	HistoryReadResponse: 665,
	WriteRequest: 671,
	WriteResponse: 674,
	Extended_RequestUniqueAttributeValues: 100000001,
	Extended_ResponseUniqueAttributeValues: 100000002,
};

export const OpcAttributeId = {
	Description: 5,
	Value: 13,
	ExtendedGroup1: 100000001,
	ExtendedGroup2: 100000002,
	ExtendedGroup3: 100000003,
	ExtendedAlarmEventsAck: 100000004,
};

// Bit flags accepted by the ExtendedAlarmEventsAck write.
export const OpcAcknowledge = {
	AckOneEvent: 0x00000001,
	RemoveOneEvent: 0x00000002,
	AckPointEvents: 0x00000004,
	RemovePointEvents: 0x00000008,
	AckAllEvents: 0x00000040,
	RemoveAllEvents: 0x00000080,
	AckOneAlarm: 0x00000100,
	AckAllAlarms: 0x00000400,
	SilenceBeep: 0x00001000,
};
