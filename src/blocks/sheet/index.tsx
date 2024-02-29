import * as React from 'react'

import * as block from '@tables/core'

import * as Model from './model'
import * as UI from './ui'
import * as versioned from './versioned'
import { SheetBlockState } from './versioned'


export type { SheetBlockState }

export function SheetOf<State extends unknown>(innerBlock: block.Block<State>) {
    return block.create<SheetBlockState<State>>({
        init: Model.init,
        view({ state, update, env }, ref) {
            return <UI.Sheet ref={ref} state={state} update={update} innerBlock={innerBlock} env={env} />
        },
        recompute(state, update, env) {
            return Model.recompute(state, update, env, innerBlock)
        },
        getResult(state) {
            return Model.getResult(state, innerBlock)
        },
        fromJSON(json: any[], update, env) {
            return versioned.fromJSON(json)(update, env, innerBlock)
        },
        toJSON(state) {
            return versioned.toJSON(state, innerBlock)
        },
    })
}