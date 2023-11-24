import * as React from 'react'

import * as block from '../../block'
import { Block, BlockUpdater, Environment } from '../../block'

import { BlockSelectorState } from './model'
import * as Model from './model'
import * as UI from './ui'

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

        onEnvironmentChange(state, update, env) {
            return Model.onEnvironmentChange(state, update, env, blockLibrary)
        },

        getResult(state, env) {
            if (state.mode === 'loading') { return undefined }
        
            return state.innerBlock?.getResult(state.innerBlockState, env)
        },

        fromJSON(json: any, update: BlockUpdater<BlockSelectorState>, env: Environment) {
            return Model.fromJSON(json, update, env, blockLibrary)
        },

        toJSON(state: BlockSelectorState) {
            if (state.mode === 'loading') {
                return {
                    mode: state.modeAfter,
                    expr: state.expr,
                    inner: state.jsonToLoad,
                }
            }

            return {
                mode: state.mode,
                expr: state.expr,
                inner: state.innerBlock?.toJSON(state.innerBlockState),
            }
        },
    })
}

