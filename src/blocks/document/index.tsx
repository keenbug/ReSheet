import * as React from 'react'

import * as block from '../../block'
import { Block, Environment, BlockViewerProps } from '../../block'
import { DocumentState } from './model'
import * as Model from './model'
import * as UI from './ui'

export { Model, UI }

export type { DocumentState }

export function DocumentOf<State>(innerBlock: Block<State>) {
    return block.create({
        init: Model.init,
        view({ state, update, env }: BlockViewerProps<DocumentState<State>>, ref) {
            return (
                <UI.DocumentUi
                    state={state}
                    update={update}
                    env={env}
                    innerBlock={innerBlock}
                    blockRef={ref}
                    />
            )
        },
        getResult(state: DocumentState<State>, env: Environment) {
            if (state.inner.pages.length === 0) {
                return undefined
            }

            return state.inner.pages.slice(-1)[0].result
        },
        fromJSON(json: any, env: Environment): DocumentState<State> {
            return Model.fromJSON(json, env, innerBlock)
        },
        toJSON(state: DocumentState<State>): {} {
            return Model.toJSON(state, innerBlock)
        }
    })
}
