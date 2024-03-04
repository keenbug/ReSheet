import * as block from '@tables/core/block'
import { Environment } from '@tables/core/block'
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
    json => ({ dispatch, env, blockLibrary }) => {
        return parseV0(json, dispatch, env, blockLibrary)
    },
)

function parseV0({ mode, inner, expr}, dispatch: block.BlockDispatcher<BlockSelectorStateV0>, env: Environment, blockLibrary: Environment): BlockSelectorStateV0 {
    function dispatchBlock(action: block.BlockAction<unknown>) {
        dispatch(state => {
            if (state.mode === 'loading') { return { state } }

            return {
                state: {
                    ...state,
                    innerBlockState: action(state.innerBlockState).state,
                }
            }
        })
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

    const innerBlockState = innerBlock.fromJSON(inner, dispatchBlock, env)
    return { mode, expr, innerBlock, innerBlockState }
}

const v0 = addRevision(vPre, {
    schema: typed(0, {
        mode: oneOf('run', 'choose'),
        expr: string,
        inner: any,
    }),
    parse: json => ({ dispatch, env, blockLibrary }) => {
        return parseV0(json, dispatch, env, blockLibrary)
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