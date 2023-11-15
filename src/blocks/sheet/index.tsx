import * as React from 'react'

import * as block from '../../block'
import { SheetBlockState, SheetBlockLine } from './model'
import * as Model from './model'
import * as UI from './ui'


export type { SheetBlockState }

export function SheetOf<State extends unknown>(innerBlock: block.Block<State>) {
    return block.create<SheetBlockState<State>>({
        init: Model.init(innerBlock.init),
        view({ state, update, env }, ref) {
            return <UI.Sheet ref={ref} state={state} update={update} innerBlock={innerBlock} env={env} />
        },
        getResult(state, env) {
            return Model.getResult(state)
        },
        fromJSON(json: any[], env) {
            return Model.fromJSON(json, innerBlock, env)
        },
        toJSON(state) {
            return state.lines.map(
                ({ id, name, isCollapsed, state }) => (
                    {
                        id,
                        name,
                        isCollapsed,
                        state: innerBlock.toJSON(state),
                    }
                )
            )
        },
    })
}