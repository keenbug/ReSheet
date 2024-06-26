import * as block from '@resheet/core/block'
import { Environment } from '@resheet/core/block'
import { addRevision, addValidator } from '@resheet/util/serialize'
import { any, oneOf, string } from '@resheet/util/validate'
import { computeExpr } from '@resheet/code/compute'

import { SafeBlock, safeBlock } from '../component'


function typed<Obj extends object>(version: number, obj: Obj): Obj {
    return {
        t: 'resheet.selector',
        v: version,
        ...obj,
    }
}


function typedTables<Obj extends object>(version: number, obj: Obj): Obj {
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
        dispatch((state, context) => {
            if (state.mode === 'loading') { return { state } }

            const result = action(state.innerBlockState, context)

            return {
                state: {
                    ...state,
                    innerBlockState: result.state,
                },
                description: result.description,
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
    schema: typedTables(0, {
        mode: oneOf('run', 'choose'),
        expr: string,
        inner: any,
    }),
    parse: json => ({ dispatch, env, blockLibrary }) => {
        return parseV0(json, dispatch, env, blockLibrary)
    },
    upgrade: before => before,
})

const v1 = addRevision(v0, {
    schema: typed(1, {
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