import * as React from 'react'

import * as block from '../../block'
import { Block, Environment, BlockViewerProps, BlockUpdater } from '../../block'
import { DocumentState } from './model'
import * as Model from './model'
import * as UI from './ui'

export { Model, UI }

export type { DocumentState }

export function DocumentOf<State>(innerBlock: Block<State>) {
    return block.create({
        init: Model.init(innerBlock.init),
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
        recompute(state, update, env) {
            return Model.recompute(state, update, env, innerBlock)
        },
        getResult(state: DocumentState<State>) {
            return Model.getResult(state, innerBlock)
        },
        fromJSON(json: any, update: BlockUpdater<DocumentState<State>>, env: Environment): DocumentState<State> {
            return Model.fromJSON(json, update, env, innerBlock)
        },
        toJSON(state: DocumentState<State>): {} {
            return Model.toJSON(state, innerBlock)
        }
    })
}
