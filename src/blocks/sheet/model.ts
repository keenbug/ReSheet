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


export function fromJSON<State>(json: any[], innerBlock: Block<State>, env: block.Environment) {
    return {
        lines: (
            Multiple.fromJSON(
                json,
                innerBlock,
                env,
                (entry, { isCollapsed = false }) => ({
                    ...entry,
                    isCollapsed
                }),
            )
        ),
    }
}