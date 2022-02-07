import { FCO } from './fc-object'
import { computeExpr } from './compute'
import { filterEntries } from '../utils'
import React from 'react'


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





export const JSComputation = FCO
    .addState({
        expr: "",
    })
    .addMethods({
        exec(env) {
            return computeExpr(this.expr, env)
        },
        getResult(env) {
            return this.exec(env)
        },
    })

export const JSComputationJSON = SimpleJSON('expr')


export const addInnerBlock = Computation => Computation
    .addState({ innerBlock: null })
    .addMethods({
        getBlock(env) {
            return this.call(Computation.getResult, env)
        },
        getResult(env) {
            if (this.innerBlock) {
                return this.innerBlock.getResult(env)
            }
            else {
                return undefined
            }
        },
    })

export const addInnerBlockJSON = ComputationJSON => ComputationJSON.addMethods({
    fromJSON({ innerBlock, ...json }, library) {
        return this
            .call(ComputationJSON.fromJSON, json, library)
            .pipe(self => {
                const result = self.getBlock(library)
                return self.update({
                    innerBlock:
                        isBlock(result) ?
                            result.fromJSON(innerBlock)
                        :
                            self.innerBlock
                })
            })
    },
    toJSON() {
        return {
            ...this.call(ComputationJSON.toJSON),
            innerBlock: this.innerBlock?.toJSON()
        }
    },
})



export const BlockTag = Symbol('block')
export const isBlock = obj => !!obj?.hasTag?.(BlockTag)

export const createBlock = fco => fco
    .pipe(checkMethodExists('view'))
    .pipe(checkMethodExists('getResult'))
    .pipe(checkMethodExists('fromJSON'))
    .pipe(checkMethodExists('toJSON'))

    .addMethods({
        render(setBlock, env) {
            return React.createElement(this.view, { block: this, setBlock, env })
        },
    })
    .addTag(BlockTag)



export const CommandFCO = JSComputation.combine(JSComputationJSON)
    .pipe(addInnerBlock)
    .pipe(addInnerBlockJSON)
