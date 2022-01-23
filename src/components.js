import { computeExpr } from './compute'
import { initialBlockState } from './value'


export const defaultCodeUI = {
    isNameVisible: true,
    isCodeVisible: true,
    isResultVisible: true,
    isStateVisible: false,
}

export const combineComponents = (...components) =>
    components.reduce(
        (entity, component) => ({
            ...entity,
            ...component,
        }),
        {},
    )

export const UtilsComponent = {
    applyWhen(cond, fn) {
        if (cond) {
            return fn(this)
        }
        return this
    }
}

export const UpdateComponent = {
    update(newValues) {
        return {
            ...this,
            ...newValues
        }
    },
    safeUpdate(newValues) {
        const safeValues = Object.fromEntries(
            Object.entries(newValues)
                .filter(([ name ]) => this.hasOwnProperty(name))
        )
        return this.update(safeValues)
    },
    mapFields(mappers) {
        const newValues =
            Object.fromEntries(
                Object.entries(mappers)
                    .map(
                        ([ name, fn ]) => [
                            name,
                            fn(this[name])
                        ]
                    )
            )
        return this.update(newValues)
    }
}

export const JSExprComponent = {
    expr: "",

    exec(env) {
        return computeExpr(this.expr, env)
    },
}

export const CachedComputationComponent = {
    cachedResult: null,
    invalidated: true,
    autorun: true,

    updateExpr(expr) {
        return this
            .update({ expr })
            .invalidate()
    },
    precompute(env) {
        if (!this.invalidated) { return this }
        return this.update({
            cachedResult: this.exec(env)
        })
    },
    invalidate() {
        if (!this.autorun) { return this }
        return this.update({
            invalidated: true
        })
    },
    forcecompute(env) {
        return this.update({
            cachedResult: this.exec(env)
        })
    },
}

export const EnvironmentComponent = {
    id: 0,
    name: "",
    prev: null,

    getDefaultName() {
        return '$' + this.id
    },
    getName() {
        return this.name.length > 0 ? this.name : this.getDefaultName()
    },
    getNextFreeId(candidate = 0) {
        const freeCandidate = candidate <= this.id ? this.id + 1 : candidate
        return this.prev ? this.prev.getNextFreeId(freeCandidate) : freeCandidate
    },

    reindex(codeNotToClashWith) {
        const prev = this.prev?.reindex(codeNotToClashWith)
        const id = codeNotToClashWith.getNextFreeId(prev ? prev.id + 1 : 0)
        return this.update({ id, prev })
    },
    append(prev) {
        if (this.prev) {
            return this.update({ prev: this.prev.append(prev) })
        }
        else {
            return this.update({ prev })
        }
    },

    getWithId(id) {
        if (this.id === id) {
            return this
        }
        else {
            return this.prev?.getWithId(id)
        }
    },
    mapWithId(id, fn) {
        if (this.id === id) {
            return fn(this)
        }
        else {
            return this.update({
                prev: this.prev?.mapWithId(id, fn)
            })
        }
    },
    toList() {
        if (!this.prev) { return [this] }
        return [ this, ...this.prev.toList() ]
    },
    fromList(list) {
        return list.reduceRight(
            (prev, code) => code.update({ prev }),
            null,
        )
    },
}

export const CachedEnvironmentComponent = {
    precomputeAll(globalEnv) {
        const prev = this.prev?.precomputeAll(globalEnv)
        const env = prev ? prev.toEnv() : {}
        return this
            .precompute({ ...globalEnv, ...env })
            .update({ prev })
    },
    forcecomputeAll(globalEnv) {
        const prev = this.prev?.forcecomputeAll(globalEnv)
        const env = prev ? prev.toEnv() : {}
        return this
            .forcecompute({ ...globalEnv, ...env })
            .update({ prev })
    },

    updateExprWithId(id, expr) {
        return this
            .mapWithId(id, code => code.update({ expr }))
            .invalidateWithId(id)
    },
    invalidateWithId(id) {
        if (this.id === id) {
            return this.invalidate()
        }
        else {
            return this
                .update({
                    prev: this.prev.invalidateWithId(id)
                })
                .invalidate()
        }
    },

    toEnv() {
        return Object.fromEntries(
            this.toList()
                .map(code => [ code.getName(), code.cachedResult ])
        )
    },

    loadFrom(data) {
        return this.safeUpdate({
            ...data,
            prev: data.prev && this.loadFrom(data.prev),
        })
    },

    stripCachedResults() {
        const prev = this.prev?.stripCachedResults()
        return this.update({
            cachedResult: null,
            invalidated: true,
            prev,
        })
    },
}

export const USAGE_MODES = [ 'use-result', 'use-data' ]

export const BlockComponent = {
    state: initialBlockState,
    usageMode: USAGE_MODES[0],
}


export const CodeComponent = combineComponents(
    UtilsComponent,
    UpdateComponent,
    JSExprComponent,
    CachedComputationComponent,
    EnvironmentComponent,
    CachedEnvironmentComponent,
    BlockComponent,
    {
        ui: combineComponents(UpdateComponent, defaultCodeUI),
    },
)
