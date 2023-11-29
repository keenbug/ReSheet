import * as React from 'react'

import * as block from '../../block'
import { SheetBlockState } from './model'
import * as Model from './model'
import * as UI from './ui'


export type { SheetBlockState }

export function SheetOf<State extends unknown>(innerBlock: block.Block<State>) {
    return block.create<SheetBlockState<State>>({
        init: Model.init(innerBlock.init),
        view({ state, update, env }, ref) {
            return <UI.Sheet ref={ref} state={state} update={update} innerBlock={innerBlock} env={env} />
        },
        onEnvironmentChange(state, update, env) {
            return Model.onEnvironmentChange(state, update, env, innerBlock)
        },
        getResult(state, env) {
            return Model.getResult(state, env, innerBlock)
        },
        fromJSON(json: any[], update, env) {
            return Model.fromJSON(json, update, env, innerBlock)
        },
        toJSON(state) {
            return state.lines.map(
                ({ id, name, visibility, state }) => (
                    {
                        id,
                        name,
                        visibility,
                        state: innerBlock.toJSON(state),
                    }
                )
            )
        },
    })
}