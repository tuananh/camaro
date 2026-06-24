'use strict'

const { Worker } = require('worker_threads')

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
    constructor(filename, size) {
        const envSize = Number(process.env.CAMARO_POOL_SIZE || 0)
        const poolSize = size || (envSize > 0 ? envSize : 1)
        const idleTimeout = idleTimeoutMs()
        this.workers = Array.from(
            { length: poolSize },
            () => new LeanWorker(filename, idleTimeout),
        )
        this.next = 0
    }

    run(task, opts) {
        const worker = this.workers[this.next++ % this.workers.length]
        return worker.run(task, opts)
    }

    destroy() {
        return Promise.all(this.workers.map((w) => w.destroy()))
    }
}

module.exports = { LeanPool }
