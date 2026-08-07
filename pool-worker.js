'use strict'

const { parentPort, workerData } = require('worker_threads')
const workerFn = require('./worker')
const { parseCamaroJson } = require('./json-parse')
const { CTRL, STATE, writeResultToSab } = require('./sab-ipc')

const sabChannel = workerData && workerData.sab ? workerData.sab : null

parentPort.on('message', async ({ id, task, sab: useSab, waitForSab }) => {
    try {
        if (useSab && sabChannel) {
            const xmlLen = Atomics.load(sabChannel.control, CTRL.XML_LEN)
            const localTask = {
                fn: task.fn,
                args: [sabChannel.xml.subarray(0, xmlLen), ...task.args.slice(1)],
            }

            Atomics.store(sabChannel.control, CTRL.STATE, STATE.BUSY)
            const raw = await workerFn(localTask)
            if (waitForSab) {
                writeResultToSab(sabChannel, raw)
                Atomics.store(sabChannel.control, CTRL.STATE, STATE.DONE)
                Atomics.notify(sabChannel.control, CTRL.STATE, 1)
                return
            }
            Atomics.store(sabChannel.control, CTRL.STATE, STATE.DONE)
            // JSON strings are cheaply cloned by V8. Avoiding the explicit
            // UTF-8 encode into SAB and decode on the parent removes two
            // copies from the latency-sensitive single-request path.
            parentPort.postMessage({ id, raw: true, result: raw })
            return
        }

        const xmlBuf = task.args[0]
        const transfer = []
        const recycleXml =
            task.recycleXml &&
            xmlBuf instanceof Uint8Array &&
            xmlBuf.buffer &&
            xmlBuf.buffer.byteLength > 0
        if (recycleXml) transfer.push(xmlBuf.buffer)
        parentPort.postMessage(
            {
                id,
                result: parseCamaroJson(await workerFn(task)),
                xmlBuf: recycleXml ? xmlBuf : undefined,
            },
            transfer,
        )
    } catch (err) {
        if (useSab && sabChannel) {
            Atomics.store(sabChannel.control, CTRL.STATE, STATE.ERROR)
            Atomics.notify(sabChannel.control, CTRL.STATE, 1)
        }
        parentPort.postMessage({
            id,
            sab: useSab && sabChannel ? true : undefined,
            error: err && err.message ? err.message : String(err),
        })
    }
})
