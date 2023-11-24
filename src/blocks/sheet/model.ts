import * as block from '../../block'
import { Block } from '../../block'
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
    readonly result: unknown

    readonly visibility: LineVisibility
}

export interface LineVisibility {
    name: boolean
    block: boolean
    result: boolean
}

export const VISIBILITY_STATES: LineVisibility[] = [
    { name: true, block: true, result: false },
    { name: false, block: true, result: false },
    { name: true, block: false, result: true },
    { name: false, block: false, result: true },
    { name: true, block: false, result: false },
]

export function lineVisibilityEq(lv1: LineVisibility, lv2: LineVisibility) {
    return lv1.name === lv2.name && lv1.block === lv2.block && lv1.result === lv2.result
}

export function nextLineVisibility(visibility: LineVisibility) {
    const lv = nextElem(visibility, VISIBILITY_STATES, lineVisibilityEq)
    console.log('switch', visibility, lv)
    return lv
}


export function init<InnerBlockState>(innerBlockInit: InnerBlockState): SheetBlockState<InnerBlockState> {
    return {
        lines: [{
            id: 0,
            name: '',
            visibility: VISIBILITY_STATES[0],
            state: innerBlockInit, 
            result: undefined,
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

export function onEnvironmentChange<State>(state: SheetBlockState<State>, update: block.BlockUpdater<SheetBlockState<State>>, env: block.Environment, innerBlock: Block<State>) {
    function updateLines(action: (lines: SheetBlockLine<State>[]) => SheetBlockLine<State>[]) {
        update(state => ({
            ...state,
            lines: action(state.lines),
        }))
    }
    return {
        ...state,
        lines: Multiple.onEnvironmentChange(state.lines, updateLines, env, innerBlock)
    }
}

export function getResult<State>(state: SheetBlockState<State>) {
    return Multiple.getLastResult(state.lines)
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


export function fromJSON<State>(json: any[], innerBlock: Block<State>, env: block.Environment): SheetBlockState<State> {
    return {
        lines: (
            Multiple.fromJSON(
                json,
                innerBlock,
                env,
                (entry, { visibility = VISIBILITY_STATES[0] }) => ({
                    ...entry,
                    visibility
                }),
            )
        ),
    }
}