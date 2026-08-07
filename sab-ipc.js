'use strict'

const { parseCamaroJson } = require('./json-parse')

const FN = { transform: 0, toJson: 1, prettyPrint: 2 }

const CTRL = {
    STATE: 0,
    REQUEST_ID: 1,
    XML_LEN: 2,
    RESULT_LEN: 3,
    FN: 4,
    HAS_NAN: 5,
}

const STATE = { IDLE: 0, BUSY: 1, DONE: 2, ERROR: -1 }

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null

function sabEnabled() {
    if (typeof SharedArrayBuffer === 'undefined') return false
    const raw = process.env.CAMARO_SAB_IPC
    if (raw === '0' || raw === 'false' || raw === 'off') return false
    return true
}

function defaultXmlSabBytes() {
    const n = Number(process.env.CAMARO_SAB_XML_BYTES || 0)
    return n > 0 ? n : 512 * 1024
}

function defaultResultSabBytes() {
    const n = Number(process.env.CAMARO_SAB_RESULT_BYTES || 0)
    return n > 0 ? n : 256 * 1024
}

function fitsSabXmlPayload(xml) {
    const max = defaultXmlSabBytes()
    if (typeof xml === 'string') return xml.length * 3 <= max
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(xml)) return xml.length <= max
    if (xml instanceof ArrayBuffer) return xml.byteLength <= max
    if (ArrayBuffer.isView(xml)) return xml.byteLength <= max
    return false
}

function createSabChannel() {
    return {
        control: new Int32Array(new SharedArrayBuffer(32)),
        xml: new Uint8Array(new SharedArrayBuffer(defaultXmlSabBytes())),
        result: new Uint8Array(new SharedArrayBuffer(defaultResultSabBytes())),
    }
}

function fnCode(fn) {
    if (fn === 'transform') return FN.transform
    if (fn === 'toJson') return FN.toJson
    if (fn === 'prettyPrint') return FN.prettyPrint
    return -1
}

function writeBytesToSab(channel, bytes) {
    if (bytes.byteLength > channel.xml.byteLength) {
        throw new RangeError(
            `XML payload (${bytes.byteLength} bytes) exceeds CAMARO_SAB_XML_BYTES (${channel.xml.byteLength})`,
        )
    }
    channel.xml.set(bytes)
    Atomics.store(channel.control, CTRL.XML_LEN, bytes.byteLength)
}

function writeStringXmlToSab(channel, xml) {
    if (!textEncoder) {
        return writeBytesToSab(channel, new Uint8Array(Buffer.from(xml, 'utf8')))
    }
    const worstCase = xml.length * 3
    if (worstCase > channel.xml.byteLength) {
        throw new RangeError(
            `XML payload (> ${worstCase} bytes) exceeds CAMARO_SAB_XML_BYTES (${channel.xml.byteLength})`,
        )
    }
    const { written } = textEncoder.encodeInto(xml, channel.xml)
    Atomics.store(channel.control, CTRL.XML_LEN, written)
}

function writeResultToSab(channel, payload) {
    let str
    let hasNan = 0
    if (typeof payload === 'string') {
        str = payload
    } else if (payload && typeof payload === 'object' && typeof payload.json === 'string') {
        str = payload.json
        hasNan = 1
    } else {
        str = JSON.stringify(payload)
    }

  if (textEncoder) {
    const { read, written } = textEncoder.encodeInto(str, channel.result)
    if (read !== str.length) {
      throw new RangeError(
        `Result exceeds CAMARO_SAB_RESULT_BYTES (${channel.result.byteLength})`,
      )
    }
    Atomics.store(channel.control, CTRL.RESULT_LEN, written)
  } else {
    const encoded = new Uint8Array(Buffer.from(str, 'utf8'))
    if (encoded.byteLength > channel.result.byteLength) {
        throw new RangeError(
            `Result (${encoded.byteLength} bytes) exceeds CAMARO_SAB_RESULT_BYTES (${channel.result.byteLength})`,
        )
    }
    channel.result.set(encoded)
    Atomics.store(channel.control, CTRL.RESULT_LEN, encoded.byteLength)
  }
    Atomics.store(channel.control, CTRL.HAS_NAN, hasNan)
    return hasNan === 1
}

function readResultFromSab(channel) {
    const len = Atomics.load(channel.control, CTRL.RESULT_LEN)
    const hasNan = Atomics.load(channel.control, CTRL.HAS_NAN) === 1
    const slice = channel.result.subarray(0, len)
    const str = textDecoder
        ? textDecoder.decode(slice)
        : Buffer.from(slice).toString('utf8')
    return parseCamaroJson(hasNan ? { json: str, hasNan: true } : str)
}

function stripXmlFromTask(task) {
    const args = task.args.slice()
    args[0] = null
    return { fn: task.fn, args, recycleXml: false }
}

module.exports = {
    FN,
    CTRL,
    STATE,
    sabEnabled,
    createSabChannel,
    fnCode,
    writeBytesToSab,
    writeStringXmlToSab,
    writeResultToSab,
    readResultFromSab,
    fitsSabXmlPayload,
    stripXmlFromTask,
}
