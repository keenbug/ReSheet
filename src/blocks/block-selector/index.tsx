import * as React from 'react'

import * as block from '@tables/core'
import { Block, Environment } from '@tables/core'

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

        recompute(state, update, env) {
            return Model.recompute(state, update, env, blockLibrary)
        },

        getResult(state) {
            if (state.mode === 'loading') { return undefined }
        
            return state.innerBlock?.getResult(state.innerBlockState)
        },

        fromJSON(json, update, env) {
            return versioned.fromJSON(json)({ update, env, blockLibrary })
        },

        toJSON(state) {
            return versioned.toJSON(state)
        },
    })
}

