import * as block from '@tables/core'
import { BlockUpdater, Environment } from '@tables/core'
import { addRevision, addValidator } from '@tables/util/serialize'
import { any, oneOf, string } from '@tables/util/validate'
import { computeExpr } from '@tables/code/compute'

import { SafeBlock, safeBlock } from '../component'


function typed<Obj extends object>(version: number, obj: Obj): Obj {
    return {
        t: 'tables.selector',
        v: version,
        ...obj,
    }
}


// Revisions

type BlockSelectorStateV0 =
    | {
        mode: 'run'
        expr: string
        innerBlock: SafeBlock<unknown>
        innerBlockState: unknown
    }
    | {
        mode: 'choose'
        expr: string
        innerBlock?: SafeBlock<unknown>
        innerBlockState?: unknown
    }
    | {
        mode: 'loading'
        expr: string
        modeAfter: Exclude<BlockSelectorStateV0['mode'], 'loading'>
        jsonToLoad: any
    }


const vPre = addValidator(
    {
        mode: oneOf('run', 'choose'),
        expr: string,
        inner: any,
    },
    json => ({ update, env, blockLibrary }) => {
        return parseV0(json, update, env, blockLibrary)
    },
)

function parseV0({ mode, inner, expr}, update: BlockUpdater<BlockSelectorStateV0>, env: Environment, blockLibrary: Environment): BlockSelectorStateV0 {
    function updateBlock(state: BlockSelectorStateV0, action: (state: unknown) => unknown): BlockSelectorStateV0 {
        if (state.mode === 'loading') { return state }
        return {
            ...state,
            innerBlockState: action(state.innerBlockState),
        }
    }

    function updateInner(action: (inner: unknown) => unknown) {
        update(state => updateBlock(state, action))
    }

    const value = computeExpr(expr, { ...blockLibrary, ...env })

    if (!block.isBlock(value)) {
        if (mode === 'run') {
            return { mode: 'loading', modeAfter: mode, expr, jsonToLoad: inner }
        }
        else {
            return { mode: 'choose', expr }
        }
    }

    const innerBlock = safeBlock(value)

    const innerBlockState = innerBlock.fromJSON(inner, updateInner, env)
    return { mode, expr, innerBlock, innerBlockState }
}

const v0 = addRevision(vPre, {
    schema: typed(0, {
        mode: oneOf('run', 'choose'),
        expr: string,
        inner: any,
    }),
    parse: json => ({ update, env, blockLibrary }) => {
        return parseV0(json, update, env, blockLibrary)
    },
    upgrade: before => before,
})


// Export current revision

export type {
    BlockSelectorStateV0 as BlockSelectorState,
}

export {
    v0 as fromJSON,
}

export function toJSON(state: BlockSelectorStateV0) {
    if (state.mode === 'loading') {
        return typed(0, {
            mode: state.modeAfter,
            expr: state.expr,
            inner: state.jsonToLoad,
        })
    }

    return typed(0, {
        mode: state.mode,
        expr: state.expr,
        inner: state.innerBlock?.toJSON(state.innerBlockState),
    })
}