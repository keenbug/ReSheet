import * as block from '@tables/core'
import { Block } from '@tables/core'
import * as Multiple from '@tables/core/multiple'

import { clampTo, nextElem } from '@tables/util'

import { LineVisibility, SheetBlockLine, SheetBlockState, VISIBILITY_STATES } from './versioned'


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
    update: block.BlockUpdater<SheetBlockState<Inner>>,
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
                block.fieldUpdater('lines', update),
                1,
            )
        )
    }
}

export function insertLineBefore<Inner>(
    state: SheetBlockState<Inner>,
    id: number,
    newLine: SheetBlockLine<Inner>,
    update: block.BlockUpdater<SheetBlockState<Inner>>,
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
                block.fieldUpdater('lines', update),
            )
        ),
    }
}

export function insertLineAfter<Inner>(
    state: SheetBlockState<Inner>,
    id: number,
    newLine: SheetBlockLine<Inner>,
    update: block.BlockUpdater<SheetBlockState<Inner>>,
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
                block.fieldUpdater('lines', update),
            )
        ),
    }
}

export function insertLineEnd<Inner>(
    state: SheetBlockState<Inner>,
    newLine: SheetBlockLine<Inner>,
    update: block.BlockUpdater<SheetBlockState<Inner>>,
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
                block.fieldUpdater('lines', update),
            )
        ),
    }
}

export function deleteLines<Inner>(
    state: SheetBlockState<Inner>,
    ids: number[],
    update: block.BlockUpdater<SheetBlockState<Inner>>,
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
                block.fieldUpdater('lines', update),
                index,
            ),
        },
    ]
}

export function recompute<State>(state: SheetBlockState<State>, update: block.BlockUpdater<SheetBlockState<State>>, env: block.Environment, innerBlock: Block<State>) {
    function updateLines(action: (lines: SheetBlockLine<State>[]) => SheetBlockLine<State>[]) {
        update(state => ({
            ...state,
            lines: action(state.lines),
        }))
    }
    return {
        ...state,
        lines: Multiple.recompute(state.lines, updateLines, env, innerBlock)
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
    update: block.BlockUpdater<SheetBlockState<State>>,
): SheetBlockState<State> {
    function updateLines(action: (lines: SheetBlockLine<State>[]) => SheetBlockLine<State>[]) {
        update(state => ({
            ...state,
            lines: action(state.lines),
        }))
    }
    return {
        ...state,
        lines: (
            Multiple.updateEntryState(
                state.lines,
                id,
                action,
                env,
                innerBlock,
                updateLines,
            )
        ),
    }
}
