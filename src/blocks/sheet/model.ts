import { Set, set } from 'immutable'

import * as block from '@resheet/core/block'
import { Block } from '@resheet/core/block'
import * as Multiple from '@resheet/core/multiple'

import { clampTo, nextElem } from '@resheet/util'

import { LineVisibility, LineWidth, SheetBlockLine, SheetBlockState, VISIBILITY_STATES, WIDTH_STATES } from './versioned'
import { fieldDispatcher } from '@resheet/util/dispatch'


export function nextLineVisibility(visibility: LineVisibility) {
    return nextElem(visibility, VISIBILITY_STATES)
}

export function nextLineWidth(width: LineWidth) {
    return nextElem(width, WIDTH_STATES)
}


export const init = {
    lines: []
}


export const lineDefaultName = Multiple.entryDefaultName
export const lineName = Multiple.entryName
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
    const lineIndex = state.lines.findIndex(line => line.id === id)
    if (lineIndex < 0) { return state }
    const line = state.lines[lineIndex]
    const newLine = action(line)

    return {
        ...state,
        lines: (
            Multiple.recomputeFrom(
                set(state.lines, lineIndex, newLine),
                id,
                env,
                Set([ lineName(line), lineName(newLine) ]),
                innerBlock,
                fieldDispatcher('lines', dispatch),
                1,
            )
                .state
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
                Set([ lineName(newLine) ]),
                innerBlock,
                fieldDispatcher('lines', dispatch),
            )
                .state
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
                Set([ lineName(newLine)] ),
                innerBlock,
                fieldDispatcher('lines', dispatch),
            )
                .state
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
                    Set([ lineName(newLine) ]),
                    innerBlock,
                    fieldDispatcher('lines', dispatch),
                )
                .state
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

    const deletedLines = state.lines.filter(line => ids.includes(line.id))
    const changedVars = Set(deletedLines.map(lineName))

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
                changedVars,
                innerBlock,
                fieldDispatcher('lines', dispatch),
                index,
            )
                .state,
        },
    ]
}

export function recompute<State>(
    state: SheetBlockState<State>,
    dispatch: block.BlockDispatcher<SheetBlockState<State>>,
    env: block.Environment,
    changedVars: Set<string> | null,
    innerBlock: Block<State>,
) {
    const dispatchLines = fieldDispatcher('lines', dispatch)

    const { state: lines, invalidated } = Multiple.recompute(state.lines, dispatchLines, env, changedVars, innerBlock)

    return {
        state: {
            ...state,
            lines,
        },
        invalidated,
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
    action: (state: State, context: block.BlockActionContext) => State,
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
