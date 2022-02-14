import { FCO } from './fc-object'
import { computeExpr } from './compute'
import { filterEntries } from '../utils'
import * as React from 'react'


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




export const SimpleJSON = <State extends {}>(...propNameList: Array<keyof State>) => FCO.addMethods({
    toJSON(this: FCO<State, unknown>) {
        return filterEntries(name => propNameList.includes(name as keyof State), this as { [key in keyof State]: unknown })
    },

    fromJSON(this: FCO<State, unknown>, json: State) {
        const ownJson = filterEntries(name => propNameList.includes(name as keyof State), json) as Partial<State>
        return this.update(ownJson)
    },
})



type Environment = { [varName: string]: any }

type JSComputation = FCO<
    { expr: string },
    {
        exec(this: JSComputation, env: Environment): any
        getResult(this: JSComputation, env: Environment): any
    }
>

export const JSComputation: JSComputation = FCO
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


export const addInnerBlock = <Computation extends JSComputation>(Computation: Computation) => Computation
    .addState({ innerBlock: null })
    .addMethods({
        getBlock(this: Computation, env: Environment, blockLibrary: Environment) {
            return this.call(Computation.getResult, { ...blockLibrary, ...env })
        },
        getResult(this: Computation & { innerBlock: { getResult(env: Environment): any } }, env: Environment) {
            if (this.innerBlock) {
                return this.innerBlock.getResult(env)
            }
            else {
                return undefined
            }
        },
    })

export const addInnerBlockJSON = ComputationJSON => ComputationJSON.addMethods({
    fromJSON({ innerBlock, ...json }, library, blockLibrary) {
        return this
            .call(ComputationJSON.fromJSON, json, { ...blockLibrary, ...library })
            .pipe(self => {
                const result = self.getBlock(library, blockLibrary)
                return self.update({
                    innerBlock:
                        isBlock(result) ?
                            result.fromJSON(innerBlock, library)
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

interface PreBlock {
    view(props: { env: Environment, block: any, setBlock: (update: (any) => any) => void }): JSX.Element
    getResult(env: Environment): any
    fromJSON(json: {}, env: Environment): any
    toJSON(): {}
}

export const createBlock = (fco: FCO<{}, PreBlock>) => fco
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
