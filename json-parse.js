'use strict';

function parseCamaroJson(payload) {
	if (typeof payload === 'string') {
		const first = payload[0];
		if (first === '{' || first === '[') return JSON.parse(payload);
		return payload;
	}
	if (payload && typeof payload === 'object' && typeof payload.json === 'string') {
		return JSON.parse(payload.json, (_, value) => (value === '__camaro_nan__' ? NaN : value));
	}
	return payload;
}

module.exports = { parseCamaroJson };
