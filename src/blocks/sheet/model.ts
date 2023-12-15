import * as block from '../../block'
import { Block, BlockUpdater } from '../../block'
import { BlockEntry } from '../../block/multiple'
import * as Multiple from '../../block/multiple'
import { nextElem } from '../../utils'

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

export function updateLineWithId<Inner>(
    state: SheetBlockState<Inner>,
    id: number,
    update: (line: SheetBlockLine<Inner>) => SheetBlockLine<Inner>,
) {
    return {
        ...state,
        lines: Multiple.updateBlockWithId(state.lines, id, update),
    }
}

export function insertLineBefore<Inner>(
    state: SheetBlockState<Inner>,
    id: number,
    newLine: SheetBlockLine<Inner>,
) {
    return {
        ...state,
        lines: Multiple.insertEntryBefore(state.lines, id, newLine),
    }
}

export function insertLineAfter<Inner>(
    state: SheetBlockState<Inner>,
    id: number,
    newLine: SheetBlockLine<Inner>,
) {
    return {
        ...state,
        lines: Multiple.insertEntryAfter(state.lines, id, newLine),
    }
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


export function fromJSON<State>(json: any[], update: BlockUpdater<SheetBlockState<State>>, env: block.Environment, innerBlock: Block<State>): SheetBlockState<State> {
    function updateLines(action: (state: SheetBlockLine<State>[]) => SheetBlockLine<State>[]) {
        update(state => ({
            lines: action(state.lines)
        }))
    }

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