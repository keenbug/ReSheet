import { FCO } from './fc-object'
import { computeExpr } from './compute'
import { initialBlockState } from './value'
import { filterEntries } from './utils'


export const BaseJSONFCO = FCO.addMethods({
    toJSON() {
        return {}
    },

    fromJSON(obj) {
        if (Object.keys(obj).length > 0) {
            console.warn('stray content after load:', obj)
        }
        return this
    }
})

export const extendSimpleJSON = (...propNameList) => ante => ante.addMethods({
    toJSON() {
        const anteJson = this.call(ante.toJSON)
        const ownJson = filterEntries(name => propNameList.includes(name), this)
        return { ...anteJson, ...ownJson }
    },

    fromJSON(json) {
        const ownJson = filterEntries(name => propNameList.includes(name), json)
        const anteJson = filterEntries(name => !propNameList.includes(name), json)
        const loaded = this.call(ante.fromJSON, anteJson)
        return loaded.update(ownJson)
    },
})


export const extendJSExprJSON = extendSimpleJSON('expr')


export const JSExprFCO = FCO
    .addState({
        expr: "",
    })
    .addMethods({
        exec(env) {
            return computeExpr(this.expr, env)
        },
    })




export const CachedComputationFCO = FCO
    .addState({
        cachedResult: null,
        invalidated: true,
        autorun: true,
    })
    .addMethods({
        updateExpr(expr) {
            return this
                .update({ expr })
                .invalidate()
        },
        precompute(env) {
            if (!this.invalidated) { return this }
            return this.forcecompute(env)
        },
        invalidate() {
            if (!this.autorun) { return this }
            return this.update({
                invalidated: true
            })
        },
        forcecompute(env) {
            return this.update({
                invalidated: false,
                cachedResult: this.exec(env)
            })
        },
    })



export const extendEnvironmentJSON = ante => ante.addMethods({
    fromJSON({ id, name, prev, ...json }) {
        const loaded = this.call(ante.fromJSON, json)
        const prevLoaded = prev && this.fromJSON(prev)
        return loaded.update({ id, name, prev: prevLoaded })
    },

    toJSON() {
        const json = this.call(ante.toJSON)
        const prev = this.prev?.toJSON() || null
        const { id, name } = this
        return { ...json, id, name, prev }
    },
})

export const EnvironmentFCO = FCO
    .addState({
        id: 0,
        name: "",
        prev: null,
    })
    .addMethods({
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
    })



export const CachedEnvironmentFCO = FCO.addMethods({
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
})



export const USAGE_MODES = [ 'use-result', 'use-data' ]

export const extendBlockJSON = extendSimpleJSON('state')

export const BlockFCO = FCO.addState({
    state: initialBlockState,
    usageMode: USAGE_MODES[0],
})



export const CodeUIOptionsFCO = FCO.addState({
    ui: {
        isNameVisible: true,
        isCodeVisible: true,
        isResultVisible: true,
        isStateVisible: false,
    },
})


export const CodeBlock = FCO.reduce(FCO.combine,
    JSExprFCO,
    CachedComputationFCO,
    EnvironmentFCO,
    BaseJSONFCO.chain(
        extendJSExprJSON,
        extendEnvironmentJSON,
        extendBlockJSON,
    ),
    CachedEnvironmentFCO,
    BlockFCO,
    CodeUIOptionsFCO,
)


export const CommandBlock = FCO.reduce(FCO.combine,
    JSExprFCO,
    CachedComputationFCO,
    FCO.addState({ blockState: initialBlockState }),
    BaseJSONFCO.chain(
        extendJSExprJSON,
        extendSimpleJSON('blockState'),
    ),
)