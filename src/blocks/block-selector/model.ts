import * as block from '../../block'
import { Block, Environment } from '../../block'
import { computeExpr } from '../../logic/compute'
import { catchAll } from '../../utils'


export interface BlockSelectorState {
    expr: string
    mode: Mode
    innerBlockState: null | unknown
    innerBlock: null | Block<unknown>
}

export type Mode = 'run' | 'choose'

export function init(
    expr: string = '',
    innerBlockInit: Block<unknown> = null
): BlockSelectorState {
    return {
        expr,
        mode: expr ? 'run' : 'choose',
        innerBlockState: innerBlockInit?.init,
        innerBlock: innerBlockInit,
    }
}


/**************** Command Actions **************/


export function setExpr(state: BlockSelectorState, expr: string): BlockSelectorState {
    return { ...state, expr }
}

export function updateMode(state: BlockSelectorState, mode: Mode): BlockSelectorState {
    return { ...state, mode }
}

export function setInnerBlockState(state: BlockSelectorState, innerBlockState: unknown): BlockSelectorState {
    return { ...state, innerBlockState }
}

export function chooseBlock(
    expr: string,
    state: BlockSelectorState,
    env: Environment,
    blockLibrary: Environment
): BlockSelectorState {
    const blockCmdResult = computeExpr(expr, { ...blockLibrary, ...env })
    if (block.isBlock(blockCmdResult)) {
        return {
            ...state,
            expr,
            mode: 'run',
            innerBlock: blockCmdResult,
            innerBlockState: blockCmdResult.init,
        }
    }
    return state
}

export function updateBlock(state: BlockSelectorState, action: (state: unknown) => unknown): BlockSelectorState {
    return {
        ...state,
        innerBlockState: action(state.innerBlockState),
    }
}

export function loadBlock({ mode, inner, expr }, library, blockLibrary) {
    try {
        const innerBlock = computeExpr(expr, { ...blockLibrary, ...library })
        const innerBlockState = catchAll(
            () => innerBlock.fromJSON(inner, library),
            () => innerBlock.init,
        )
        return { mode, innerBlock, innerBlockState }
    }
    catch (e) {
        return {
            mode: 'choose',
            innerBlock: null,
            innerBlockState: null,
         }
    }
}
