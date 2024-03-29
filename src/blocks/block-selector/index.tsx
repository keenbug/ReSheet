import * as React from 'react'

import * as block from '@resheet/core/block'
import { Block, Environment } from '@resheet/core/block'

import * as Model from './model'
import * as UI from './ui'
import { BlockSelectorState } from './versioned'
import * as versioned from './versioned'

export type { BlockSelectorState }

export function BlockSelector(
    expr: string = '',
    innerBlockInit: Block<unknown> = undefined,
    blockLibrary: Environment,
) {
    return block.create<BlockSelectorState>({
        init: Model.init(expr, innerBlockInit),

        view({ state, dispatch, env }, ref) {
            return (
                <UI.BlockSelectorUI
                    ref={ref}
                    state={state}
                    dispatch={dispatch}
                    env={env}
                    blockLibrary={blockLibrary}
                    />
            )
        },

        recompute(state, dispatch, env, changedVars) {
            return Model.recompute(state, dispatch, env, changedVars, blockLibrary)
        },

        getResult(state) {
            if (state.mode === 'loading') { return undefined }
        
            return state.innerBlock?.getResult(state.innerBlockState)
        },

        fromJSON(json, dispatch, env) {
            return versioned.fromJSON(json)({ dispatch, env, blockLibrary })
        },

        toJSON(state) {
            return versioned.toJSON(state)
        },
    })
}

