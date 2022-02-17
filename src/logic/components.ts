import { FCO } from './fc-object'
import { computeExpr } from './compute'
import { filterEntries } from '../utils'
import * as Block from './block'


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
        getResult(this: Computation & { innerBlock: { state: unknown, block: Block.Block<unknown> } }, env: Environment) {
            if (this.innerBlock) {
                return this.innerBlock.block.getResult(this.innerBlock.state, env)
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
                        Block.isBlock(result) ?
                            {
                                state: result.fromJSON(innerBlock, library),
                                block: result,
                            }
                        :
                            self.innerBlock
                })
            })
    },
    toJSON() {
        return {
            ...this.call(ComputationJSON.toJSON),
            innerBlock: this.innerBlock?.block?.toJSON(this.innerBlock?.state)
        }
    },
})




export const CommandFCO = JSComputation.combine(JSComputationJSON)
    .pipe(addInnerBlock)
    .pipe(addInnerBlockJSON)


interface FCOBlock {
    view: any
    getResult: any
    fromJSON: any
    toJSON: any
}

export const fcoBlockAdapter = <FCO extends FCOBlock>(fco: FCO) => Block.create<FCO>({
    init: fco,
    view({ state, setState, env }) {
        return state.view({ block: state, setBlock: setState, env })
    },
    getResult(state, env) {
        return state.getResult(env)
    },
    fromJSON(json, env) {
        return fco.fromJSON(json, env)
    },
    toJSON(state) {
        return state.toJSON()
    }
})
