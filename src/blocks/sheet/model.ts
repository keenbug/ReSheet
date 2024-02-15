import * as block from '../../block'
import { Block, BlockUpdater } from '../../block'
import { BlockEntry } from '../../block/multiple'
import * as Multiple from '../../block/multiple'
import { clampTo, nextElem } from '../../utils'
import { any, assertValid, array, oneOf, strict } from '../../utils/validate'

export interface SheetBlockState<InnerBlockState> {
    readonly lines: SheetBlockLine<InnerBlockState>[]
}

export interface SheetBlockLine<InnerBlockState> extends BlockEntry<InnerBlockState> {
    readonly id: number
    readonly name: string
    readonly state: InnerBlockState

    readonly visibility: LineVisibility
}

export type LineVisibility =
    | "block"
    | "result"

export const VISIBILITY_STATES: LineVisibility[] = [
    "block",
    "result",
]

export function nextLineVisibility(visibility: LineVisibility) {
    return nextElem(visibility, VISIBILITY_STATES)
}


export function init<InnerBlockState>(innerBlockInit: InnerBlockState): SheetBlockState<InnerBlockState> {
    return {
        lines: [{
            id: 0,
            name: '',
            visibility: VISIBILITY_STATES[0],
            state: innerBlockInit, 
        }]
    }
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

export function deleteLine<Inner>(
    state: SheetBlockState<Inner>,
    id: number,
    update: block.BlockUpdater<SheetBlockState<Inner>>,
    env: block.Environment,
    innerBlock: Block<Inner>,
): [number, SheetBlockState<Inner>] {
    const index = state.lines.findIndex(line => line.id === id)
    const linesWithoutId = state.lines.filter(line => line.id !== id)
    const prevIndex = clampTo(0, linesWithoutId.length, index - 1)
    const prevId = linesWithoutId[prevIndex].id

    return [
        prevId,
        {
            ...state,
            lines: Multiple.recomputeFrom(
                linesWithoutId,
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

const visibilityJSONV = oneOf(...VISIBILITY_STATES)
const sheetLineJSONV = strict(Multiple.entryJSONV(any, { visibility: visibilityJSONV }))
const sheetJSONV = array(sheetLineJSONV)

export function fromJSON<State>(json: any[], update: BlockUpdater<SheetBlockState<State>>, env: block.Environment, innerBlock: Block<State>): SheetBlockState<State> {
    function updateLines(action: (state: SheetBlockLine<State>[]) => SheetBlockLine<State>[]) {
        update(state => ({
            lines: action(state.lines)
        }))
    }

    assertValid(sheetJSONV, json)

    return {
        lines: (
            Multiple.fromJSON(
                json,
                updateLines,
                env,
                innerBlock,
                (entry, { visibility }) => ({
                    ...entry,
                    visibility: VISIBILITY_STATES.includes(visibility) ? visibility : VISIBILITY_STATES[0],
                }),
            )
        ),
    }
}