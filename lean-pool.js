'use strict'

const os = require('os')
const { Worker } = require('worker_threads')

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
    // Match piscina default: shut down idle workers immediately so scripts can exit.
    return 0
}

class LeanWorker {
    constructor(filename, idleTimeout) {
        this.filename = filename
        this.idleTimeout = idleTimeout
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
        const worker = new Worker(this.filename)
        worker.unref()
        worker.on('message', ({ id, result, error }) => {
            const p = this.pending.get(id)
            this.pending.delete(id)
            if (!p) return
            if (error) p.reject(new Error(error))
            else p.resolve(result)
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

    run(task, opts = {}) {
        this.ensureWorker()
        this.clearIdleTimer()
        const id = ++this.seq
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
    constructor(filename, maxThreads) {
        const envSize = Number(process.env.CAMARO_POOL_SIZE || 0)
        this.filename = filename
        this.idleTimeout = idleTimeoutMs()
        this.maxThreads =
            maxThreads || (envSize > 0 ? envSize : defaultMaxThreads())
        this.workers = []
        this.queue = []
        for (let i = 0; i < Math.min(DEFAULT_MIN_THREADS, this.maxThreads); i++) {
            const worker = new LeanWorker(this.filename, this.idleTimeout)
            worker.ensureWorker()
            this.workers.push(worker)
        }
    }

    run(task, opts = {}) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, opts, resolve, reject })
            this.drain()
        })
    }

    drain() {
        while (this.queue.length > 0) {
            let worker = this.workers.find((w) => w.pendingCount === 0)
            if (!worker && this.workers.length < this.maxThreads) {
                worker = new LeanWorker(this.filename, this.idleTimeout)
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
