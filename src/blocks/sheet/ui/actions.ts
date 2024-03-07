import * as React from 'react'

import { Block, BlockAction, Environment, extractActionDescription } from '@tables/core/block'
import * as Multiple from '@tables/core/multiple'

import { clampTo } from '@tables/util'

import { EnvDispatcher } from '../../utils/hooks'
import { findScrollableAncestor } from '../../utils/ui'

import * as Model from '../model'
import { SheetBlockState } from '../versioned'
import * as versioned from '../versioned'
import { fieldDispatcher } from '@tables/util/dispatch'


export interface SheetLineRef {
    getElement(): HTMLElement
    getInnerContainer(): HTMLElement
    getVarInput(): HTMLElement
    isFocused(): boolean
    focus(): void
    focusVar(): void
    focusInner(): void
}


export function findLineRefContaining(node: Node, refMap: Map<number, SheetLineRef>) {
    return Array.from(refMap.entries()).find(([,lineRef]) => lineRef.getElement()?.contains?.(node))
}

export function findFocused(refMap: Map<number, SheetLineRef>) {
    if (!document.activeElement) {
        return undefined
    }
    return findLineRefContaining(document.activeElement, refMap)
}

function findRelativeTo<Id, Line extends { id: Id }>(lines: Line[], id: Id, relativeIndex: number): Line | null {
    if (lines.length === 0) { return null }
    const index = lines.findIndex(line => line.id === id)
    if (index < 0) { return null }
    const newIndex = clampTo(0, lines.length, index + relativeIndex)
    return lines[newIndex]
}


export type FocusTarget = 'line' | 'var' | 'inner'

export function focusLineRef(ref: SheetLineRef, target: FocusTarget) {
    switch (target) {
        case 'line':
            ref.focus()
            return

        case 'var':
            ref.focusVar()
            return

        case 'inner':
            ref.focusInner()
            return
    }
}

/** Focus `ref` and keep the same FocusTarget as before or fall back to `fallbackTarget` */
function focusLineRefSameOr(refMap: Map<number, SheetLineRef>, ref: SheetLineRef, fallbackTarget: FocusTarget) {
    const focus = findFocused(refMap)
    if (focus) {
        const [id, currentRef] = focus
        const currentTarget = currentRef.isFocused() ? 'line' : 'inner'
        focusLineRef(ref, currentTarget)
    }
    else {
        focusLineRef(ref, fallbackTarget)
    }
}

export type Actions<Inner> = ReturnType<typeof ACTIONS<Inner>>

export function ACTIONS<Inner extends unknown>(
    dispatch: EnvDispatcher<SheetBlockState<Inner>>,
    container: React.MutableRefObject<HTMLElement>,
    refMap: Map<number, SheetLineRef>,
    innerBlock: Block<Inner>,
    selectedIds: null | number[],
    setSelectionAnchorIds: React.Dispatch<React.SetStateAction<{ start: number, end: number } | null>>,
) {
    function insertBeforeCode(state: SheetBlockState<Inner>, id: number, env: Environment, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
        const newId = Model.nextFreeId(state);
        return {
            state: Model.insertLineBefore(
                state,
                id,
                {
                    id: newId,
                    name: '',
                    visibility: versioned.VISIBILITY_STATES[0],
                    state: innerBlock.init,
                },
                dispatch,
                env,
                innerBlock,
            ),
            effect() { focusLineRef(refMap.get(newId), focusTarget) },
        }
    }

    function insertAfterCode(state: SheetBlockState<Inner>, id: number, env: Environment, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
        const newId = Model.nextFreeId(state)
        return {
            state: Model.insertLineAfter(
                state,
                id,
                {
                    id: newId,
                    name: '',
                    visibility: versioned.VISIBILITY_STATES[0],
                    state: innerBlock.init,
                },
                dispatch,
                env,
                innerBlock,
            ),
            effect() { focusLineRef(refMap.get(newId), focusTarget) },
        }
    }

    function insertEnd(state: SheetBlockState<Inner>, env: Environment, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
        const newId = Model.nextFreeId(state)
        return {
            state: Model.insertLineEnd(
                state,
                {
                    id: newId,
                    name: '',
                    visibility: versioned.VISIBILITY_STATES[0],
                    state: innerBlock.init,
                },
                dispatch,
                env,
                innerBlock,
            ),
            effect() { focusLineRef(refMap.get(newId), focusTarget) },
        }
    }


    return {
        scroll(amount: number) {
            dispatch(state => ({
                state,
                effect() {
                    const scrollableContainer = findScrollableAncestor(container.current)
                    if (scrollableContainer) {
                        scrollableContainer.scrollBy({
                            top: amount * scrollableContainer.clientHeight,
                            behavior: 'smooth',
                        })
                    }
                },
            }))
        },


        focusUp() {
            setSelectionAnchorIds(null)
            dispatch((state: SheetBlockState<Inner>) => ({
                state,
                effect() {
                    const focused = findFocused(refMap)
                    if (focused === undefined) {
                        refMap.get(state.lines[0].id)?.focus()
                    }
                    else {
                        const [id, lineRef] = focused
                        const focusTarget: FocusTarget = lineRef.isFocused() ? "line" : "inner"
                        const prevId = findRelativeTo(state.lines, id, -1)?.id
                        const prevLine = refMap.get(prevId)
                        prevLine && focusLineRef(prevLine, focusTarget)
                    }
                },
            }))
        },

        focusDown() {
            setSelectionAnchorIds(null)
            dispatch((state: SheetBlockState<Inner>) => ({
                state,
                effect() {
                    const focused = findFocused(refMap)
                    if (focused === undefined) {
                        refMap.get(state.lines[state.lines.length - 1].id)?.focus()
                    }
                    else {
                        const [id, lineRef] = focused
                        const focusTarget: FocusTarget = lineRef.isFocused() ? "line" : "inner"
                        const nextId = findRelativeTo(state.lines, id, 1)?.id
                        const nextLine = refMap.get(nextId)
                        nextLine && focusLineRef(nextLine, focusTarget)
                    }
                },
            }))
        },



        selectUp() {
            dispatch(state => ({
                state,
                effect() {
                    const focused = findFocused(refMap)
                    if (focused === undefined) {
                        refMap.get(state.lines[0].id)?.focus()
                    }
                    else {
                        const [id, lineRef] = focused
                        const focusTarget: FocusTarget = lineRef.isFocused() ? "line" : "inner"
                        const prevId = findRelativeTo(state.lines, id, -1)?.id
                        const prevLine = refMap.get(prevId)
                        setSelectionAnchorIds(selection => ({ start: selection?.start ?? id, end: prevId }))
                        prevLine && focusLineRef(prevLine, focusTarget)
                    }
                },
            }))
        },

        selectDown() {
            dispatch(state => ({
                state,
                effect() {
                    const focused = findFocused(refMap)
                    if (focused === undefined) {
                        refMap.get(state.lines[state.lines.length - 1].id)?.focus()
                    }
                    else {
                        const [id, lineRef] = focused
                        const focusTarget: FocusTarget = lineRef.isFocused() ? "line" : "inner"
                        const nextId = findRelativeTo(state.lines, id, 1)?.id
                        const nextLine = refMap.get(nextId)
                        setSelectionAnchorIds(selection => ({ start: selection?.start ?? id, end: nextId }))
                        nextLine && focusLineRef(nextLine, focusTarget)
                    }
                },
            }))
        },

        focusFirst() {
            setSelectionAnchorIds(null)
            dispatch(state => ({
                state,
                effect() {
                    const firstId = state.lines[0].id
                    refMap.get(firstId)?.focus()
                }
            }))
        },

        focusLast() {
            setSelectionAnchorIds(null)
            dispatch(state => ({
                state,
                effect() {
                    const lastId = state.lines.slice(-1)[0].id
                    refMap.get(lastId)?.focus()
                }
            }))
        },

        rename(id: number) {
            setSelectionAnchorIds(null)
            dispatch(state => ({
                state,
                effect() {
                    refMap.get(id)?.focusVar()
                },
            }))
        },

        setName(id: number, name: string) {
            dispatch((state, env) => ({
                state: Model.updateLineWithId(state, id, line => ({ ...line, name }), dispatch, env, innerBlock),
            }));
        },

        switchCollapse(id: number) {
            dispatch(state => ({
                state: Model.updateLineUiWithId(state, id, line => ({
                    ...line,
                    visibility: Model.nextLineVisibility(line.visibility),
                })),
                effect() {
                    const line = refMap.get(id)
                    if (line && !line.getElement().contains(document.activeElement)) {
                        line.focus();
                    }
                },
            }))
        },

        dispatchInner(
            id: number,
            action: BlockAction<Inner>,
            innerBlock: Block<Inner>,
            env: Environment
        ) {
            dispatch(state => extractActionDescription(action, pureAction =>
                Model.updateLineBlock(state, id, pureAction, innerBlock, env, dispatch)
            ))
        },

        copy(state: SheetBlockState<Inner>, innerBlock: Block<Inner>, putIntoClipboard: (type: string, content: string) => void) {
            let selectedLines: versioned.SheetBlockLine<Inner>[]
            if (selectedIds) {
                selectedLines = selectedIds.map(id => state.lines.find(line => line.id === id))
            }
            else {
                const focusedId = findFocused(refMap)?.[0]
                const focusedLine = focusedId !== undefined && state.lines.find(line => line.id === focusedId)
                if (focusedLine) {
                    selectedLines = [focusedLine]
                }
            }
            if (selectedLines) {
                putIntoClipboard(
                    'application/x.tables-block',
                    JSON.stringify(
                        versioned.toJSON(
                            { lines: selectedLines },
                            innerBlock,
                        ),
                    ),
                )
            }
        },

        paste(json: any, innerBlock: Block<Inner>) {
            const dispatchLines = fieldDispatcher('lines', dispatch)
            dispatch((state, env) => {
                if (state.lines.length === 0) {
                    const newState = versioned.fromJSON(json)(dispatch, env, innerBlock)
                    return {
                        state: newState,
                        effect() {
                            const firstPastedId = newState.lines[0]?.id
                            const lastPastedId = newState.lines.slice(-1)[0]?.id
                            if (firstPastedId !== undefined && lastPastedId !== undefined) {
                                setSelectionAnchorIds({ start: firstPastedId, end: lastPastedId })
                            }

                            const lastPastedRef = refMap.get(lastPastedId)
                            lastPastedRef && focusLineRefSameOr(refMap, lastPastedRef, 'line')
                        }
                    }
                }

                const lineId = (
                    (selectedIds && selectedIds.slice(-1)[0])
                    ?? findFocused(refMap)?.[0]
                    ?? state.lines.slice(-1)[0]?.id
                )
                try {
                    const siblingsUntilId = Multiple.getResultEnv(Multiple.getEntriesUntil(state.lines, lineId), innerBlock)
                    const envForPasted = { ...env, ...siblingsUntilId }
                    const { lines } = versioned.fromJSON(json)(() => {}, envForPasted, innerBlock)
                    const nextId = Model.nextFreeId(state)
                    const remappedLines = lines.map((line, index) => ({
                        ...line,
                        id: nextId + index,
                    }))
                    const newState = {
                        ...state,
                        lines: (
                            Multiple.recomputeFrom(
                                Multiple.insertEntryAfter(state.lines, lineId, ...remappedLines),
                                lineId,
                                env,
                                innerBlock,
                                dispatchLines,
                                1,
                            )
                        )
                    }
                    return {
                        state: newState,
                        effect() {
                            const firstPastedId = remappedLines[0]?.id
                            const lastPastedId = remappedLines.slice(-1)[0]?.id
                            if (firstPastedId !== undefined && lastPastedId !== undefined) {
                                setSelectionAnchorIds({ start: firstPastedId, end: lastPastedId })
                            }

                            const lastPastedRef = refMap.get(lastPastedId)
                            lastPastedRef && focusLineRefSameOr(refMap, lastPastedRef, 'line')
                        },
                    }
                }
                catch (e) {
                    return { state }
                }
            })
        },

        insertBeforeCode(id: number, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
            setSelectionAnchorIds(null)
            dispatch((state, env) => insertBeforeCode(state, id, env, innerBlock, focusTarget))
        },

        insertAfterCode(id: number, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
            setSelectionAnchorIds(null)
            dispatch((state, env) => insertAfterCode(state, id, env, innerBlock, focusTarget))
        },

        insertEnd(innerBlock: Block<Inner>, focusTarget: FocusTarget = 'inner') {
            setSelectionAnchorIds(null)
            dispatch((state, env) => insertEnd(state, env, innerBlock, focusTarget))
        },

        focusOrCreatePrev(id: number, innerBlock: Block<Inner>) {
            setSelectionAnchorIds(null)
            dispatch((state, env) => {
                const currentIndex = state.lines.findIndex(line => line.id === id)
                if (currentIndex < 0) { return { state } }
                if (currentIndex === 0) {
                    return insertBeforeCode(state, id, env, innerBlock, 'inner')
                }

                const prevLine = state.lines[currentIndex - 1]
                return {
                    state,
                    effect() {
                        refMap.get(prevLine.id)?.focusInner()
                    }
                }
            })
        },

        focusOrCreateNext(id: number, innerBlock: Block<Inner>) {
            setSelectionAnchorIds(null)
            dispatch((state, env) => {
                const currentIndex = state.lines.findIndex(line => line.id === id)
                if (currentIndex < 0) { return { state } }
                if (currentIndex === state.lines.length - 1) {
                    return insertAfterCode(state, id, env, innerBlock, 'inner')
                }

                const nextLine = state.lines[currentIndex + 1]
                return {
                    state,
                    effect() {
                        refMap.get(nextLine.id)?.focusInner()
                    }
                }
            })
        },

        deleteCode(id: number, focusAfter: FocusTarget = 'line') {
            setSelectionAnchorIds(null)
            dispatch((state, env) => {
                const idsToDelete = selectedIds ?? [id]
                const [prevId, newState] = Model.deleteLines(state, idsToDelete, dispatch, env, innerBlock)
                return {
                    state: newState,
                    effect() {
                        if (refMap.has(prevId)) {
                            focusLineRef(refMap.get(prevId), focusAfter)
                        }
                        else {
                            container.current.focus()
                        }
                    },
                }
            })
        },
    }

}
