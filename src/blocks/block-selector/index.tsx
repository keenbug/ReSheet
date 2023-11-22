import * as React from 'react'

import * as block from '../../block'
import { Block, Environment } from '../../block'
import { catchAll } from '../../utils'

import { BlockSelectorState } from './model'
import * as Model from './model'
import * as UI from './ui'

export type { BlockSelectorState }

export function BlockSelector(
    expr: string = '',
    innerBlockInit: Block<unknown> = null,
    blockLibrary: Environment,
) {
    return block.create<BlockSelectorState>({
        init: Model.init(expr, innerBlockInit),

        view({ state, update, env }, ref) {
            return (
                <UI.BlockSelectorUI
                    ref={ref}
                    state={state}
                    update={update}
                    env={env}
                    blockLibrary={blockLibrary}
                    />
            )
        },

        onEnvironmentChange(state, update, env) {
            if (state.mode === 'choose') { return state }

            function updateInner(action: (state: unknown) => unknown) {
                update(state => ({
                    ...state,
                    innerBlockState: action(state.innerBlockState),
                }))
            }

            return {
                ...state,
                innerBlockState: state.innerBlock.onEnvironmentChange(state.innerBlockState, updateInner, env)
            }
        },

        getResult(state, env) {
            if (state.mode === 'choose') { return null }
        
            return state.innerBlock?.getResult(state.innerBlockState, env)
        },

        fromJSON(json: any, library) {
            const { mode = 'choose', inner = null, expr = "" } = json
            return {
                mode,
                expr,
                ...Model.loadBlock(json, library, blockLibrary),
            }
        },

        toJSON({ mode, expr, innerBlock, innerBlockState }) {
            return {
                mode,
                expr,
                inner:
                    mode === 'choose' ?
                        catchAll(
                            () => innerBlock.toJSON(innerBlockState),
                            () => null,
                        )
                    : mode === 'run' && innerBlock !== null && innerBlockState !== null ?
                        innerBlock.toJSON(innerBlockState)
                    :
                        innerBlock.init
                ,
            }
        },
    })
}

