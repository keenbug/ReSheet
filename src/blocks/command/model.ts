import * as block from '../../logic/block'
import { BlockDesc } from '../../logic/block'
import { computeExpr } from '../../logic/compute'
import { catchAll } from '../../utils'


export interface CommandState {
    expr: string
    mode: Mode
    innerBlockState: null | unknown
    innerBlock: null | BlockDesc<unknown>
}

export type Mode = 'run' | 'choose'

export function init(
    expr: string = '',
    innerBlockInit: BlockDesc<unknown> = null
): CommandState {
    return {
        expr,
        mode: expr ? 'run' : 'choose',
        innerBlockState: innerBlockInit?.init,
        innerBlock: innerBlockInit,
    }
}


/**************** Command Actions **************/


export function setCommandExpr(state: CommandState, expr: string): CommandState {
    return { ...state, expr }
}

export function updateMode(state: CommandState, mode: Mode): CommandState {
    return { ...state, mode }
}

export function setInnerBlockState(state: CommandState, innerBlockState: unknown): CommandState {
    return { ...state, innerBlockState }
}

export function chooseBlock(
    state: CommandState,
    env: block.Environment,
    blockLibrary: block.Environment
): CommandState {
    const blockCmdResult = computeExpr(state.expr, { ...blockLibrary, ...env })
    if (block.isBlock(blockCmdResult)) {
        return {
            ...state,
            mode: 'run',
            innerBlock: blockCmdResult,
            innerBlockState:
                state.innerBlockState === null || state.innerBlockState === undefined ?
                    blockCmdResult.init
                :
                    state.innerBlockState
            ,
        }
    }
    return state
}

export function updateBlock(state: CommandState, action: (state: unknown) => unknown): CommandState {
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
