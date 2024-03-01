import * as React from 'react'

import * as block from '@tables/core'

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
        view({ state, update, env }, ref) {
            return <UI.Sheet ref={ref} state={state} update={update} innerBlock={safeInnerBlock} env={env} />
        },
        recompute(state, update, env) {
            return Model.recompute(state, update, env, safeInnerBlock)
        },
        getResult(state) {
            return Model.getResult(state, safeInnerBlock)
        },
        fromJSON(json: any[], update, env) {
            return versioned.fromJSON(json)(update, env, safeInnerBlock)
        },
        toJSON(state) {
            return versioned.toJSON(state, safeInnerBlock)
        },
    })
}