import * as React from 'react'

import * as block from '@tables/core/block'

import * as Model from './model'
import * as UI from './ui'
import * as versioned from './versioned'
import { SheetBlockState } from './versioned'
import { safeBlock } from '../component'


export type { SheetBlockState }

export function SheetOf<State extends unknown>(innerBlock: block.Block<State>) {
    const safeInnerBlock = safeBlock(innerBlock)

    return block.create<SheetBlockState<State>>({
        init: Model.init,
        view({ state, dispatch, env }, ref) {
            return <UI.Sheet ref={ref} state={state} dispatch={dispatch} innerBlock={safeInnerBlock} env={env} />
        },
        recompute(state, dispatch, env) {
            return Model.recompute(state, dispatch, env, safeInnerBlock)
        },
        getResult(state) {
            return Model.getResult(state, safeInnerBlock)
        },
        fromJSON(json: any[], dispatch, env) {
            return versioned.fromJSON(json)(dispatch, env, safeInnerBlock)
        },
        toJSON(state) {
            return versioned.toJSON(state, safeInnerBlock)
        },
    })
}