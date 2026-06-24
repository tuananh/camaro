'use strict'

const { parentPort } = require('worker_threads')
const workerFn = require('./worker')

parentPort.on('message', async ({ id, task }) => {
    try {
        const result = await workerFn(task)
        parentPort.postMessage({ id, result })
    } catch (err) {
        parentPort.postMessage({
            id,
            error: err && err.message ? err.message : String(err),
        })
    }
})
