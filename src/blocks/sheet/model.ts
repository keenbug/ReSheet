import * as block from '../../block'
import { Block } from '../../block'
import { BlockEntry } from '../../block/multiple'
import * as Multiple from '../../block/multiple'

export interface SheetBlockState<InnerBlockState> {
    readonly lines: SheetBlockLine<InnerBlockState>[]
}

export interface SheetBlockLine<InnerBlockState> extends BlockEntry<InnerBlockState> {
    readonly id: number
    readonly name: string
    readonly state: InnerBlockState
    readonly result: unknown

    readonly isCollapsed: boolean
}


export function init<InnerBlockState>(innerBlockInit: InnerBlockState): SheetBlockState<InnerBlockState> {
    return {
        lines: [{
            id: 0,
            name: '',
            isCollapsed: false,
            state: innerBlockInit, 
            result: null
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

export function recomputeSheetResults<State>(
    state: SheetBlockState<State>,
    innerBlock: Block<State>,
    env: block.Environment,
    startFromId?: number,
) {
    return {
        ...state,
        lines: Multiple.recomputeResults(state.lines, innerBlock, env, startFromId)
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
): SheetBlockState<State> {
    return {
        ...state,
        lines: Multiple.updateEntryState(
            state.lines,
            id,
            action,
            innerBlock,
            env,
        ),
    }
}


export function fromJSON<State>(json: any[], innerBlock: Block<State>, env: block.Environment) {
    return {
        lines: Multiple.fromJSON(
            json,
            innerBlock,
            env,
            (entry, { isCollapsed = false }) => ({
                ...entry,
                isCollapsed
            }))
    }
}