import * as React from 'react'

import * as block from '../../../block'
import { Block, Environment } from '../../../block'
import * as Multiple from '../../../block/multiple'

import { clampTo } from '../../../utils'

import { EUpdater } from '../../../ui/hooks'
import { findScrollableAncestor } from '../../../ui/utils'

import * as Model from '../model'
import { SheetBlockState } from '../versioned'
import * as versioned from '../versioned'


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
    eupdate: EUpdater<SheetBlockState<Inner>>,
    container: React.MutableRefObject<HTMLElement>,
    refMap: Map<number, SheetLineRef>,
    innerBlock: Block<Inner>,
    selectedIds: null | number[],
    setSelectionAnchorIds: React.Dispatch<React.SetStateAction<{ start: number, end: number } | null>>,
) {
    function update(action: (state: SheetBlockState<Inner>) => SheetBlockState<Inner>) {
        eupdate(state => ({ state: action(state) }))
    }

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
                update,
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
                update,
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
                update,
                env,
                innerBlock,
            ),
            effect() { focusLineRef(refMap.get(newId), focusTarget) },
        }
    }

    function scroll(amount: number) {
        return {
            effect() {
                const scrollableContainer = findScrollableAncestor(container.current)
                if (scrollableContainer) {
                    scrollableContainer.scrollBy({
                        top: amount * scrollableContainer.clientHeight,
                        behavior: 'smooth',
                    })
                }
            },
        }
    }


    return {
        scroll(amount: number) { eupdate(() => scroll(amount)) },

        focusUp() {
            setSelectionAnchorIds(null)
            eupdate((state: SheetBlockState<Inner>) => ({
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
            eupdate((state: SheetBlockState<Inner>) => ({
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
            eupdate(state => ({
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
            eupdate(state => ({
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
            eupdate(state => ({
                effect() {
                    const firstId = state.lines[0].id
                    refMap.get(firstId)?.focus()
                }
            }))
        },

        focusLast() {
            setSelectionAnchorIds(null)
            eupdate(state => ({
                effect() {
                    const lastId = state.lines.slice(-1)[0].id
                    refMap.get(lastId)?.focus()
                }
            }))
        },

        rename(id: number) {
            setSelectionAnchorIds(null)
            eupdate(() => ({
                effect() {
                    refMap.get(id)?.focusVar()
                },
            }))
        },

        setName(id: number, name: string) {
            eupdate((state, env) => ({
                state: Model.updateLineWithId(state, id, line => ({ ...line, name }), update, env, innerBlock),
            }));
        },

        switchCollapse(id: number) {
            eupdate(state => ({
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

        updateInner(
            id: number,
            action: (state: Inner) => Inner,
            innerBlock: Block<Inner>,
            env: Environment
        ) {
            update(state =>
                Model.updateLineBlock(state, id, action, innerBlock, env, update)
            )
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
            const updateLines = block.fieldUpdater('lines', update)
            eupdate((state, env) => {
                if (state.lines.length === 0) {
                    const newState = versioned.fromJSON(json)(update, env, innerBlock)
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
                                updateLines,
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
                    return {}
                }
            })
        },

        insertBeforeCode(id: number, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
            setSelectionAnchorIds(null)
            eupdate((state, env) => insertBeforeCode(state, id, env, innerBlock, focusTarget))
        },

        insertAfterCode(id: number, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
            setSelectionAnchorIds(null)
            eupdate((state, env) => insertAfterCode(state, id, env, innerBlock, focusTarget))
        },

        insertEnd(innerBlock: Block<Inner>, focusTarget: FocusTarget = 'inner') {
            setSelectionAnchorIds(null)
            eupdate((state, env) => insertEnd(state, env, innerBlock, focusTarget))
        },

        focusOrCreatePrev(id: number, innerBlock: Block<Inner>) {
            setSelectionAnchorIds(null)
            eupdate((state, env) => {
                const currentIndex = state.lines.findIndex(line => line.id === id)
                if (currentIndex < 0) { return {} }
                if (currentIndex === 0) {
                    return insertBeforeCode(state, id, env, innerBlock, 'inner')
                }

                const prevLine = state.lines[currentIndex - 1]
                return {
                    effect() {
                        refMap.get(prevLine.id)?.focusInner()
                    }
                }
            })
        },

        focusOrCreateNext(id: number, innerBlock: Block<Inner>) {
            setSelectionAnchorIds(null)
            eupdate((state, env) => {
                const currentIndex = state.lines.findIndex(line => line.id === id)
                if (currentIndex < 0) { return {} }
                if (currentIndex === state.lines.length - 1) {
                    return insertAfterCode(state, id, env, innerBlock, 'inner')
                }

                const nextLine = state.lines[currentIndex + 1]
                return {
                    effect() {
                        refMap.get(nextLine.id)?.focusInner()
                    }
                }
            })
        },

        deleteCode(id: number, focusAfter: FocusTarget = 'line') {
            setSelectionAnchorIds(null)
            eupdate((state, env) => {
                const idsToDelete = selectedIds ?? [id]
                const [prevId, newState] = Model.deleteLines(state, idsToDelete, update, env, innerBlock)
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
