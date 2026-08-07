'use strict'

const os = require('os')
const { Worker } = require('worker_threads')
const { parseCamaroJson } = require('./json-parse')
const {
    sabEnabled,
    createSabChannel,
    writeBytesToSab,
    writeStringXmlToSab,
    readResultFromSab,
    stripXmlFromTask,
    CTRL,
    STATE,
    fnCode,
} = require('./sab-ipc')

const DEFAULT_MIN_THREADS = 1

function defaultMaxThreads() {
    const cpus =
        typeof os.availableParallelism === 'function'
            ? os.availableParallelism()
            : os.cpus().length
    // Match piscina default maxThreads (availableParallelism * 1.5).
    return Math.max(Math.ceil(cpus * 1.5), 1)
}

function idleTimeoutMs() {
    const raw = process.env.CAMARO_IDLE_TIMEOUT
    if (raw === 'Infinity') return Infinity
    if (raw !== undefined && raw !== '') {
        const n = Number(raw)
        if (Number.isFinite(n) && n >= 0) return n
    }
    // Shut down idle workers so scripts can exit; set CAMARO_IDLE_TIMEOUT=Infinity
    // to keep workers warm (e.g. long-running servers or throughput benches).
    return 0
}

class LeanWorker {
    constructor(filename, idleTimeout, onRecycleXml, useSab) {
        this.filename = filename
        this.idleTimeout = idleTimeout
        this.onRecycleXml = onRecycleXml
        this.useSab = useSab
        this.useSabWait =
            useSab &&
            typeof Atomics.waitAsync === 'function' &&
            typeof Atomics.notify === 'function'
        this.sabChannel = useSab ? createSabChannel() : null
        this.worker = null
        this.seq = 0
        this.pending = new Map()
        this.idleTimer = null
    }

    get pendingCount() {
        return this.pending.size
    }

    ensureWorker() {
        if (this.worker) return
        const workerOpts =
            this.sabChannel != null ? { workerData: { sab: this.sabChannel } } : undefined
        const worker = new Worker(this.filename, workerOpts)
        worker.unref()
        worker.on('message', ({ id, result, error, xmlBuf, sab, raw }) => {
            if (xmlBuf && this.onRecycleXml) this.onRecycleXml(xmlBuf)
            const p = this.pending.get(id)
            this.pending.delete(id)
            if (!p) return
            if (error) {
                p.reject(new Error(error))
            } else if (sab && this.sabChannel) {
                try {
                    p.resolve(readResultFromSab(this.sabChannel))
                } catch (err) {
                    p.reject(err)
                }
            } else if (raw) {
                try {
                    p.resolve(parseCamaroJson(result))
                } catch (err) {
                    p.reject(err)
                }
            } else {
                p.resolve(result)
            }
            if (this.pending.size === 0) this.scheduleIdleShutdown()
        })
        worker.on('error', (err) => {
            for (const p of this.pending.values()) p.reject(err)
            this.pending.clear()
            this.terminate()
        })
        worker.on('exit', () => {
            if (this.worker === worker) this.worker = null
        })
        this.worker = worker
    }

    clearIdleTimer() {
        if (this.idleTimer !== null) {
            clearTimeout(this.idleTimer)
            this.idleTimer = null
        }
    }

    scheduleIdleShutdown() {
        this.clearIdleTimer()
        if (this.idleTimeout === Infinity || !this.worker) return
        this.idleTimer = setTimeout(() => {
            this.idleTimer = null
            if (this.pending.size === 0) this.terminate()
        }, this.idleTimeout)
        this.idleTimer.unref()
    }

    settleSabResult(id) {
        if (
            !this.sabChannel ||
            Atomics.load(this.sabChannel.control, CTRL.STATE) !== STATE.DONE
        ) {
            return
        }
        const p = this.pending.get(id)
        this.pending.delete(id)
        if (!p) return
        try {
            p.resolve(readResultFromSab(this.sabChannel))
        } catch (err) {
            p.reject(err)
        }
        if (this.pending.size === 0) this.scheduleIdleShutdown()
    }

    waitForSabResult(id) {
        const channel = this.sabChannel
        if (!channel) return
        const waiter = Atomics.waitAsync(channel.control, CTRL.STATE, STATE.BUSY)
        if (waiter.async) {
            waiter.value.then(() => this.settleSabResult(id))
        } else {
            this.settleSabResult(id)
        }
    }

    run(task, opts = {}) {
        this.ensureWorker()
        this.clearIdleTimer()
        const id = ++this.seq

        if (task.sab && this.sabChannel) {
            try {
                if (typeof task.xmlString === 'string') {
                    writeStringXmlToSab(this.sabChannel, task.xmlString)
                } else {
                    writeBytesToSab(this.sabChannel, task.args[0])
                }
                Atomics.store(this.sabChannel.control, CTRL.REQUEST_ID, id)
                Atomics.store(this.sabChannel.control, CTRL.FN, fnCode(task.fn))
            } catch (err) {
                return Promise.reject(err)
            }
            return new Promise((resolve, reject) => {
                this.pending.set(id, { resolve, reject })
                if (this.useSabWait) {
                    Atomics.store(this.sabChannel.control, CTRL.STATE, STATE.BUSY)
                }
                this.worker.postMessage({
                    id,
                    sab: true,
                    waitForSab: this.useSabWait,
                    task: stripXmlFromTask(task),
                })
                if (this.useSabWait) this.waitForSabResult(id)
            })
        }

        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject })
            this.worker.postMessage({ id, task }, opts.transferList || [])
        })
    }

    terminate() {
        this.clearIdleTimer()
        if (!this.worker) return Promise.resolve()
        const w = this.worker
        this.worker = null
        return w.terminate()
    }

    destroy() {
        return this.terminate()
    }
}

class LeanPool {
    constructor(filename, opts = {}) {
        const maxThreads = opts.maxThreads
        const envSize = Number(process.env.CAMARO_POOL_SIZE || 0)
        this.filename = filename
        this.idleTimeout = idleTimeoutMs()
        this.onRecycleXml = opts.onRecycleXml
        this.useSab = opts.useSab != null ? opts.useSab : sabEnabled()
        this.maxThreads =
            maxThreads || (envSize > 0 ? envSize : defaultMaxThreads())
        this.workers = []
        this.queue = []
        for (let i = 0; i < Math.min(DEFAULT_MIN_THREADS, this.maxThreads); i++) {
            const worker = new LeanWorker(
                this.filename,
                this.idleTimeout,
                this.onRecycleXml,
                this.useSab,
            )
            worker.ensureWorker()
            this.workers.push(worker)
        }
    }

    run(task, opts = {}) {
        if (this.queue.length === 0) {
            for (const worker of this.workers) {
                if (worker.pendingCount === 0) {
                    return worker.run(task, opts)
                }
            }
        }
        return new Promise((resolve, reject) => {
            this.queue.push({ task, opts, resolve, reject })
            this.drain()
        })
    }

    drain() {
        while (this.queue.length > 0) {
            let worker = this.workers.find((w) => w.pendingCount === 0)
            if (!worker && this.workers.length < this.maxThreads) {
                worker = new LeanWorker(
                    this.filename,
                    this.idleTimeout,
                    this.onRecycleXml,
                    this.useSab,
                )
                this.workers.push(worker)
            }
            if (!worker) break

            const job = this.queue.shift()
            worker
                .run(job.task, job.opts)
                .then(job.resolve, job.reject)
                .finally(() => this.drain())
        }
    }

    destroy() {
        return Promise.all(this.workers.map((w) => w.destroy()))
    }
}

module.exports = { LeanPool }
