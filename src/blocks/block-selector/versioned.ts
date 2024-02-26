import * as block from '../../block'
import { Block, BlockUpdater, Environment } from '../../block'
import { computeExpr } from '../../logic/compute'

import { any, oneOf, string } from '../../utils/validate'
import { addRevision, addValidator } from '../../utils/serialize'


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
        innerBlock: Block<unknown>
        innerBlockState: unknown
    }
    | {
        mode: 'choose'
        expr: string
        innerBlock?: Block<unknown>
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

    const innerBlock = computeExpr(expr, { ...blockLibrary, ...env })

    if (mode === 'run' && !block.isBlock(innerBlock)) {
        return { mode: 'loading', modeAfter: mode, expr, jsonToLoad: inner }
    }

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