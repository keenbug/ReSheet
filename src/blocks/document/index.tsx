import * as React from 'react'

import * as block from '../../logic/block'
import { Block, Environment, BlockViewerProps } from '../../logic/block'
import { DocumentState } from './model'
import * as Model from './model'
import * as UI from './ui'


export type { DocumentState }

export function DocumentOf<State>(innerBlock: Block<State>) {
    return block.create({
        init: Model.init(innerBlock.init),
        view({ state, update, env }: BlockViewerProps<DocumentState<State>>) {
            return (
                <UI.DocumentUi
                    state={state}
                    update={update}
                    env={env}
                    innerBlock={innerBlock}
                    />
            )
        },
        getResult(state: DocumentState<State>, env: Environment) {
            return innerBlock.getResult(state.blockState, env)
        },
        fromJSON(json: any, env: Environment): DocumentState<State> {
            return Model.fromJSON(json, env, innerBlock)
        },
        toJSON(state: DocumentState<State>): {} {
            return Model.toJSON(state, innerBlock)
        }
    })
}