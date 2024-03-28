import { Set } from 'immutable'

import * as block from '@resheet/core/block'
import { Block, Environment } from '@resheet/core/block'
import { computeExpr } from '@resheet/code/compute'

import { safeBlock } from '../component'

import { BlockSelectorState } from './versioned'


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

export function blockDispatcher(dispatch: block.BlockDispatcher<BlockSelectorState>): block.BlockDispatcher<unknown> {
    return function dispatchBlock(action) {
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
}

export function recompute(
    state: BlockSelectorState,
    dispatch: block.BlockDispatcher<BlockSelectorState>,
    env: Environment,
    changedVars: Set<string> | null,
    blockLibrary: Environment,
): {
    state: BlockSelectorState,
    invalidated: boolean,
 } {
    const dispatchBlock = blockDispatcher(dispatch)

    const innerBlock = computeExpr(state.expr, { ...blockLibrary, ...env })

    if (!block.isBlock(innerBlock)) {
        return { state, invalidated: false }
    }

    const safeInnerBlock = safeBlock(innerBlock)

    if (state.mode === 'loading') {
        return {
            state: {
                mode: state.modeAfter,
                expr: state.expr,
                innerBlock: safeInnerBlock,
                innerBlockState: safeInnerBlock.fromJSON(state.jsonToLoad, dispatchBlock, env),
            },
            invalidated: true,
        }
    }

    const { state: innerBlockState, invalidated } = safeInnerBlock.recompute(state.innerBlockState, dispatchBlock, env, changedVars)
        
    return {
        state: {
            ...state,
            innerBlock: safeInnerBlock,
            innerBlockState,
        },
        invalidated,
    }
}