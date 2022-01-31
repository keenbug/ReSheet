import { FCO } from './fc-object'
import { computeExpr } from './compute'
import { filterEntries } from './utils'
import React from 'react'


const checkPropExists = propertyName => obj => {
    if (obj.hasOwnProperty(propertyName)) {
        return obj
    }
    else {
        throw new TypeError(
            `Property missing: .${propertyName} does not exists on ${obj}`
        )
    }
}

const checkPropertyType = (propertyName, typeName) => obj => {
    if (typeof obj[propertyName] === typeName) {
        return obj
    }
    else {
        throw new TypeError(
            `Property type mismatch: typeof .${propertyName} must be "${typeName}" but is "${typeof obj[propertyName]}" on ${obj}`
        )
    }
}

const checkMethodExists = methodName => obj => {
    const proto = Object.getPrototypeOf(obj)
    if (proto.hasOwnProperty(methodName) && typeof proto[methodName] === 'function') {
        return obj
    }
    else {
        throw new TypeError(
            `Method missing: .${methodName}() is missing or not a function on the prototype of ${obj}`,
        )
    }
}




export const SimpleJSON = (...propNameList) => FCO.addMethods({
    toJSON() {
        return filterEntries(name => propNameList.includes(name), this)
    },

    fromJSON(json) {
        const ownJson = filterEntries(name => propNameList.includes(name), json)
        return this.update(ownJson)
    },
})





export const JSComputationFCO = FCO
    .addState({
        expr: "",
    })
    .addMethods({
        exec(env) {
            return computeExpr(this.expr, env)
        },
    })

export const JSComputationJSON = SimpleJSON('expr')




export const addCachedComputation = ComputationFCO => ComputationFCO
    .pipe(checkPropertyType('expr', 'string'))
    .pipe(checkMethodExists('exec'))

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
                cachedResult: this.exec(env),
            })
        },
    })



export const addEnvironmentJSON = EnvironmentComponent => EnvironmentComponent
    .pipe(checkPropertyType('id', 'number'))
    .pipe(checkPropertyType('name', 'string'))

    .addMethods({
        fromJSON({ id, name, prev, ...rest }) {
            const restLoaded = this.call(EnvironmentComponent.fromJSON, rest)
            const prevLoaded = prev ? this.fromJSON(prev) : null
            return restLoaded.update({ id, name, prev: prevLoaded })
        },

        toJSON() {
            const rest = this.call(EnvironmentComponent.toJSON)
            const prev = this.prev?.toJSON() || null
            const { id, name } = this
            return { ...rest, id, name, prev }
        },
    })

export const addEnvironment = InnerBlock => InnerBlock
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
                (prev, entry) => entry.update({ prev }),
                null,
            )
        },
    })



export const addCachedEnvironment = ComputationFCO => ComputationFCO
    .pipe(addCachedComputation)
    .pipe(addEnvironment)

    .addMethods({
        precomputeAll(globalEnv) {
            const prev = this.prev?.precomputeAll(globalEnv)
            const env = prev ? prev.toEnv() : {}
            return this
                .update({ prev })
                .precompute({ ...globalEnv, ...env })
        },
        forcecomputeAll(globalEnv) {
            const prev = this.prev?.forcecomputeAll(globalEnv)
            const env = prev ? prev.toEnv() : {}
            return this
                .update({ prev })
                .forcecompute({ ...globalEnv, ...env })
        },

        updateExprWithId(id, expr) {
            return this
                .mapWithId(id, entry => entry.updateExpr(expr))
        },
        invalidateWithId(id) {
            return this
                .update({
                    prev:
                        this.id === id ?
                            this.prev
                        :
                            this.prev.invalidateWithId(id)
                    ,
                })
                .invalidate()
        },

        toEnv() {
            return Object.fromEntries(
                this.toList()
                    .map(entry => [ entry.getName(), entry.cachedResult ])
            )
        },
    })




export const addInnerBlock = CachedComputation => CachedComputation
    .pipe(checkPropExists('cachedResult'))
    .pipe(checkMethodExists('precompute'))

    .addState({ innerBlock: null })
    .addMethods({
        startBlock(library) {
            const resultBefore = this.cachedResult
            const computed = this.precompute(library)
            const resultChanged = resultBefore !== computed.cachedResult
            if (resultChanged && isBlock(computed.cachedResult)) {
                return computed.update({ innerBlock: computed.cachedResult })
            }
            else {
                return computed
            }
        }
    })

export const addInnerBlockJSON = CachedComputationJSON => CachedComputationJSON.addMethods({
    fromJSON({ innerBlock, ...json }, library) {
        return this
            .call(CachedComputationJSON.fromJSON, json)
            .precompute(library)
            .pipeWhen(self => isBlock(self.cachedResult),
                self => self.update({
                    innerBlock: self.cachedResult.fromJSON(innerBlock)
                })
            )
    },
    toJSON() {
        return {
            ...this.call(CachedComputationJSON.toJSON),
            innerBlock: this.innerBlock?.toJSON()
        }
    },
})



const BlockTag = Symbol('block')
export const isBlock = obj => obj?.blockTag === BlockTag

export const createBlock = fco => fco
    .pipe(checkMethodExists('view'))
    .pipe(checkMethodExists('fromJSON'))
    .pipe(checkMethodExists('toJSON'))

    .addMethods({
        blockTag: BlockTag,
        render(setBlock) {
            return React.createElement(this.view, { block: this, setBlock })
        },
    })



export const CodeUIOptionsFCO = FCO.addState({
    ui: {
        isNameVisible: true,
        isCodeVisible: true,
        isResultVisible: true,
        isStateVisible: false,
    },
})

export const CodeFCO = JSComputationFCO.combine(JSComputationJSON)
    .pipe(addCachedEnvironment)
    .pipe(addEnvironmentJSON)
    .combine(CodeUIOptionsFCO)



export const CommandFCO = JSComputationFCO.combine(JSComputationJSON)
    .pipe(addCachedEnvironment)
    .pipe(addEnvironmentJSON)

    .pipe(addInnerBlock)
    .pipe(addInnerBlockJSON)
