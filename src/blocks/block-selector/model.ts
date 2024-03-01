import * as block from '@tables/core'
import { Block, Environment } from '@tables/core'
import { computeExpr } from '@tables/code/compute'
import { BlockSelectorState } from './versioned'
import { safeBlock } from '../component'


export function init(
    expr: string = '',
    innerBlock?: Block<unknown>
): BlockSelectorState {
    return {
        expr,
        mode: innerBlock ? 'run' : 'choose',
        innerBlock: safeBlock(innerBlock),
        innerBlockState: innerBlock?.init,
    }
}


export function chooseBlock(
    expr: string,
    state: BlockSelectorState,
    blockEnv: Environment,
): BlockSelectorState {
    const blockCmdResult = computeExpr(expr, blockEnv)
    if (block.isBlock(blockCmdResult)) {
        return {
            ...state,
            expr,
            mode: 'run',
            innerBlock: safeBlock(blockCmdResult),
            innerBlockState: blockCmdResult.init,
        }
    }
    return state
}

export function updateBlock(state: BlockSelectorState, action: (state: unknown) => unknown): BlockSelectorState {
    if (state.mode === 'loading') { return state }
    return {
        ...state,
        innerBlockState: action(state.innerBlockState),
    }
}

export function recompute(
    state: BlockSelectorState,
    update: block.BlockUpdater<BlockSelectorState>,
    env: Environment,
    blockLibrary: Environment,
): BlockSelectorState {
    function updateInner(action: (inner: unknown) => unknown) {
        update(state => updateBlock(state, action))
    }

    const innerBlock = computeExpr(state.expr, { ...blockLibrary, ...env })

    if (!block.isBlock(innerBlock)) {
        return state
    }

    if (state.mode === 'loading') {
        return {
            mode: state.modeAfter,
            expr: state.expr,
            innerBlock: safeBlock(innerBlock),
            innerBlockState: innerBlock.fromJSON(state.jsonToLoad, updateInner, env),
        }
    }
        
    return {
        ...state,
        innerBlock: safeBlock(innerBlock),
        innerBlockState: innerBlock.recompute(state.innerBlockState, updateInner, env)
    }
}