import * as React from 'react'

import * as block from '../../logic/block'
import { BlockDesc } from '../../logic/block'
import { catchAll } from '../../utils'

import { CommandState } from './model'
import * as Model from './model'
import * as UI from './ui'

export type { CommandState }

export function CommandBlock(
    expr: string = '',
    innerBlockInit: BlockDesc<unknown> = null,
    stateEditorBlock: BlockDesc<unknown>,
    blockLibrary: block.Environment,
) {
    return block.create<CommandState>({
        init: Model.init(expr, innerBlockInit),

        view({ state, update, env }) {
            return (
                <UI.CommandBlockUI
                    state={state}
                    update={update}
                    env={env}
                    stateEditorBlock={stateEditorBlock}
                    blockLibrary={blockLibrary}
                    />
            )
        },

        getResult(state, env) {
            if (state.mode === 'choose') { return null }
        
            return state.innerBlock.getResult(state.innerBlockState, env)
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

