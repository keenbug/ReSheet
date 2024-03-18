import * as block from '@resheet/core/block'
import { Block } from '@resheet/core/block'
import * as Multiple from '@resheet/core/multiple'

import { clampTo, nextElem } from '@resheet/util'

import { LineVisibility, SheetBlockLine, SheetBlockState, VISIBILITY_STATES } from './versioned'
import { fieldDispatcher } from '@resheet/util/dispatch'


export function nextLineVisibility(visibility: LineVisibility) {
    return nextElem(visibility, VISIBILITY_STATES)
}


export const init = {
    lines: []
}


export const lineDefaultName = Multiple.entryDefaultName
export const lineToEnv = Multiple.entryToEnv

export function nextFreeId(state: SheetBlockState<unknown>) {
    return Multiple.nextFreeId(state.lines)
}

export function updateLineUiWithId<Inner>(
    state: SheetBlockState<Inner>,
    id: number,
    action: (line: SheetBlockLine<Inner>) => SheetBlockLine<Inner>,
) {
    return {
        ...state,
        lines: Multiple.updateBlockWithId(state.lines, id, action),
    }
}

export function updateLineWithId<Inner>(
    state: SheetBlockState<Inner>,
    id: number,
    action: (line: SheetBlockLine<Inner>) => SheetBlockLine<Inner>,
    dispatch: block.BlockDispatcher<SheetBlockState<Inner>>,
    env: block.Environment,
    innerBlock: Block<Inner>,
) {
    return {
        ...state,
        lines: (
            Multiple.recomputeFrom(
                Multiple.updateBlockWithId(state.lines, id, action),
                id,
                env,
                innerBlock,
                fieldDispatcher('lines', dispatch),
                1,
            )
        )
    }
}

export function insertLineBefore<Inner>(
    state: SheetBlockState<Inner>,
    id: number,
    newLine: SheetBlockLine<Inner>,
    dispatch: block.BlockDispatcher<SheetBlockState<Inner>>,
    env: block.Environment,
    innerBlock: Block<Inner>,
) {
    return {
        ...state,
        lines: (
            Multiple.recomputeFrom(
                Multiple.insertEntryBefore(state.lines, id, newLine),
                id,
                env,
                innerBlock,
                fieldDispatcher('lines', dispatch),
            )
        ),
    }
}

export function insertLineAfter<Inner>(
    state: SheetBlockState<Inner>,
    id: number,
    newLine: SheetBlockLine<Inner>,
    dispatch: block.BlockDispatcher<SheetBlockState<Inner>>,
    env: block.Environment,
    innerBlock: Block<Inner>,
) {
    return {
        ...state,
        lines: (
            Multiple.recomputeFrom(
                Multiple.insertEntryAfter(state.lines, id, newLine),
                newLine.id,
                env,
                innerBlock,
                fieldDispatcher('lines', dispatch),
            )
        ),
    }
}

export function insertLineEnd<Inner>(
    state: SheetBlockState<Inner>,
    newLine: SheetBlockLine<Inner>,
    dispatch: block.BlockDispatcher<SheetBlockState<Inner>>,
    env: block.Environment,
    innerBlock: Block<Inner>,
) {
    return {
        ...state,
        lines: (
            Multiple.recomputeFrom(
                [...state.lines, newLine],
                newLine.id,
                env,
                innerBlock,
                fieldDispatcher('lines', dispatch),
            )
        ),
    }
}

export function deleteLines<Inner>(
    state: SheetBlockState<Inner>,
    ids: number[],
    dispatch: block.BlockDispatcher<SheetBlockState<Inner>>,
    env: block.Environment,
    innerBlock: Block<Inner>,
): [number, SheetBlockState<Inner>] {
    const index = state.lines.findIndex(line => ids.includes(line.id))
    const linesWithoutIds = state.lines.filter(line => !ids.includes(line.id))
    const prevIndex = clampTo(0, linesWithoutIds.length, index - 1)
    const prevId = linesWithoutIds[prevIndex]?.id

    return [
        prevId,
        {
            ...state,
            lines: Multiple.recomputeFrom(
                linesWithoutIds,
                undefined,
                env,
                innerBlock,
                fieldDispatcher('lines', dispatch),
                index,
            ),
        },
    ]
}

export function recompute<State>(state: SheetBlockState<State>, dispatch: block.BlockDispatcher<SheetBlockState<State>>, env: block.Environment, innerBlock: Block<State>) {
    const dispatchLines = fieldDispatcher('lines', dispatch)
    return {
        ...state,
        lines: Multiple.recompute(state.lines, dispatchLines, env, innerBlock)
    }
}

export function getResult<State>(state: SheetBlockState<State>, innerBlock: Block<State>) {
    return Multiple.getLastResult(state.lines, innerBlock)
}

export function getLineResult<State>(line: SheetBlockLine<State>, innerBlock: Block<State>) {
    return innerBlock.getResult(line.state)
}


export function updateLineBlock<State>(
    state: SheetBlockState<State>,
    id: number,
    action: (state: State) => State,
    innerBlock: Block<State>,
    env: block.Environment,
    dispatch: block.BlockDispatcher<SheetBlockState<State>>,
): SheetBlockState<State> {
    const dispatchLines = fieldDispatcher('lines', dispatch)
    return {
        ...state,
        lines: (
            Multiple.updateEntryState(
                state.lines,
                id,
                action,
                env,
                innerBlock,
                dispatchLines,
            )
        ),
    }
}
