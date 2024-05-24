// MIT License

// Copyright (c) 2020 Phil Plückthun,
// Copyright (c) 2021 Formidable,
// Copyright (c) 2024 Daniel Krüger

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Extracted from: https://github.com/FormidableLabs/use-editable

import { useState, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import { useSyncRef } from '@resheet/util/hooks'
import { clampTo } from '@resheet/util'

export interface SelRange<Pos> {
    start: Pos
    end: Pos
}

export function posToRowCol(text: string, position: number): { row: number, col: number } {
    const linesBefore = text.slice(0, position).split('\n')
    const row = linesBefore.length - 1
    const col = linesBefore.slice(-1)[0]?.length ?? 0
    return { row, col }
}

export function rowColToPos(text: string, rowCol: { row: number, col: number }): number {
    const row = Math.max(0, rowCol.row)

    const lines = text.split('\n')
    const linesBefore = lines.slice(0, row)
    const line = lines[row]

    const rowOffset = linesBefore.join('\n').length
    const rowNewline = linesBefore.length > 0 ? 1 : 0
    const colOffset = clampTo(0, line.length + 1, rowCol.col)

    return rowOffset + rowNewline + colOffset
}

export function selRangeToRowCol(text: string, range: SelRange<number>): SelRange<{ row: number, col: number }> {
    const start = posToRowCol(text, range.start)
    const end = posToRowCol(text, range.end)
    return { start, end }
}

export function selRangeToPos(text: string, range: SelRange<{ row: number, col: number }>): SelRange<number> {
    const start = rowColToPos(text, range.start)
    const end = rowColToPos(text, range.end)
    return { start, end }
}

const observerSettings = {
    characterData: true,
    characterDataOldValue: true,
    childList: true,
    subtree: true,
}

export function getCurrentRange() {
    if (window.getSelection().rangeCount === 0) { return null }
    return window.getSelection().getRangeAt(0)
}

export function setCurrentRange(range: Range) {
    const selection = window.getSelection()
    selection.empty()
    selection.addRange(range)
}

function toString(element: HTMLElement): string {
    const queue: Node[] = [element.firstChild!]

    let content = ''
    let node: Node
    while ((node = queue.pop()!)) {
        if (node.nodeType === Node.TEXT_NODE) {
            content += node.textContent
        }
        else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'BR') {
            content += '\n'
        }

        if (node.nextSibling) { queue.push(node.nextSibling) }
        if (node.firstChild) { queue.push(node.firstChild) }
    }

    // contenteditable Quirk: Without plaintext-only a pre/pre-wrap element must always
    // end with at least one newline character
    if (content[content.length - 1] !== '\n') { content += '\n' }

    return content
}

export interface SplitText {
    linesBefore: string[]
    lineBefore: string
    selection: string
    lineAfter: string
    linesAfter: string[]
}

export function splitByPosition(text: string, position: SelRange<number>): SplitText {
    const allBefore = text.slice(0, position.start)
    const selection = text.slice(position.start, position.end)
    const allAfter = text.slice(position.end)

    const allLinesBefore = allBefore.split('\n')
    const allLinesAfter = allAfter.split('\n')

    const linesBefore = allLinesBefore.slice(0, -1)
    const lineBefore = allLinesBefore.slice(-1)[0] ?? ""
    const [lineAfter, linesAfter] = (
        selection.slice(-1) === '\n' ?
            ["", allLinesAfter]
        :
            [allLinesAfter[0] ?? "", allLinesAfter.slice(1)]
    )

    return {
        linesBefore,
        lineBefore,
        selection: selection.slice(-1) === '\n' ? selection.slice(0, -1) : selection,
        lineAfter,
        linesAfter,
    }
}

export function getPosition(element: HTMLElement): SelRange<number> {
    // Firefox Quirk: Since plaintext-only is unsupported the position
    // of the text here is retrieved via a range, rather than traversal
    // as seen in makeRange()
    const range = getCurrentRange()
    if (!range) { return { start: 0, end: 0 } }

    const untilStart = document.createRange()
    untilStart.setStart(element, 0)
    untilStart.setEnd(range.startContainer, range.startOffset)
    const start = untilStart.toString().length

    const untilEnd = document.createRange()
    untilEnd.setStart(element, 0)
    untilEnd.setEnd(range.endContainer, range.endOffset)
    const end = untilEnd.toString().length

    return { start, end }
}

export function makeRange(
    element: HTMLElement,
    start: number,
    end?: number,
): Range {
    if (start <= 0) { start = 0 }

    const range = document.createRange()

    const startResult = findPositionInNodes(start, element)
    if (startResult === null) {
        if (element.lastChild) {
            range.setStartAfter(element.lastChild)
        }
        else {
            range.setStart(element, 0)
        }
    }
    else {
        const [startNode, startNodeOffset] = startResult
        range.setStart(startNode, startNodeOffset)
    }

    if (!end || end <= start) { return range }
    const endResult = findPositionInNodes(end, element)
    if (endResult === null) {
        if (element.lastChild) {
            range.setEndAfter(element.lastChild)
        }
        else {
            range.setEnd(element, 0)
        }
    }
    else {
        const [endNode, endNodeOffset] = endResult
        range.setEnd(endNode, endNodeOffset)
    }

    return range
}

function lastTextDescendant(node: Node): Text | null {
    if (node instanceof Text) {
        return node
    }
    if (node.lastChild) {
        return lastTextDescendant(node.lastChild)
    }
    return null
}


export function findPositionInNodes(
    position: number,
    container: Node,
): null | [Node, number] {
    const queue: Node[] = [container.firstChild]

    let node: Node
    let currentPosition = 0
    while ((node = queue.pop())) {
        let nodeTextLength = 0
        if (node.nodeType === Node.TEXT_NODE) {
            nodeTextLength = node.textContent!.length
        }
        else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'BR') {
            nodeTextLength = 1
        }

        if (nodeTextLength > 0) {
            const offset = position - currentPosition
            // searched position inside this node?
            if (offset <= nodeTextLength) {
                return [node, offset]
            }

            currentPosition += nodeTextLength
        }

        if (node.nextSibling) { queue.push(node.nextSibling) }
        if (node.firstChild) { queue.push(node.firstChild) }
    }

    return null
}


interface State {
    observer: MutationObserver
    observerDisconnected: boolean
    mutations: MutationRecord[]
    positionToUpdateTo: SelRange<number> | null
    dontUpdate: boolean
    lastRange: Range | null
    isMouseDown: boolean
}

export interface Editable {
    /** Replaces the entire content of the editable while adjusting the caret position. */
    update(content: string, position?: SelRange<number>): void

    /** Inserts new text at the caret position while deleting text in range of the offset (which accepts negative offsets). */
    edit(append: string, deleteOffset?: number, editOffset?: number): void

    /** Positions the caret where specified */
    move(pos: number | { row: number, column: number }, extent?: number): void

    /** Returns the current editor state, as usually received in onChange */
    getState(): { text: string, position: SelRange<number> }
}

export function useEditable(
    elementRef: { current: HTMLElement | undefined | null },
    onChange: (text: string, position: SelRange<number>) => void,
): Editable {
    const [, rerender] = useState([])
    const { current: state } = useRef<State>({
        observer: null,
        observerDisconnected: false,
        mutations: [],
        positionToUpdateTo: null,
        dontUpdate: false,
        lastRange: null,
        isMouseDown: false,
    })
    const editable = useMemo<Editable>(
        () => editableActions(elementRef, state, onChange),
        [elementRef, state, onChange],
    )

    // Only for SSR / server-side logic
    if (typeof navigator !== 'object') { return editable }

    const onChangeRef = useSyncRef(onChange)
    const flushChanges = useCallback(function flushChanges() {
        if (!elementRef.current) { return }
        if (state.dontUpdate) { return }

        state.mutations.push(...state.observer.takeRecords())
        const position = getPosition(elementRef.current)
        if (state.mutations.length > 0) {
            state.observer.disconnect()
            state.observerDisconnected = true

            const content = toString(elementRef.current)
            state.positionToUpdateTo = position

            rewindMutations(state.mutations)
            state.mutations.splice(0)

            onChangeRef.current(content, position)
        }
    }, [])

    // Setup MutationObserver once
    useLayoutEffect(() => {
        if (typeof MutationObserver !== 'undefined') {
            state.observer = new MutationObserver(batch => {
                state.mutations.push(...batch)
                flushChanges()
            })
        }

        return () => {
            state.observerDisconnected = true
            state.observer.disconnect()
        }
    }, [])

    // Setup element and its EventListeners
    useLayoutEffect(() => {
        if (!elementRef.current) { return }
        const element = elementRef.current

        if (element.contentEditable !== 'plaintext-only' && element.contentEditable !== 'true') {
            try {
                // Firefox and IE11 do not support plaintext-only mode
                element.contentEditable = 'plaintext-only'
            }
            catch (_error) {
                element.contentEditable = 'true'
            }
        }

        function onKeyDown(event: KeyboardEvent) {
            if (event.defaultPrevented || event.isComposing) { return }
            if (state.observerDisconnected) {
                // React Quirk: It's expected that we may lose events while disconnected, which is why
                // we'd like to block some inputs if they're unusually fast. However, this always
                // coincides with React not executing the update immediately and then getting stuck,
                // which can be prevented by issuing a dummy state change.
                event.preventDefault()
                rerender([])
                return
            }

            if (element.contentEditable !== 'plaintext-only') {
                fixNonPlaintextKeyDown(event, editable, element)
            }
        }

        function onPaste(event: ClipboardEvent) {
            event.preventDefault()
            editable.edit(event.clipboardData.getData('text/plain'))
            flushChanges()
        }

        function onCompositionStart() {
            // don't update during composition, otherwise composition breaks
            state.dontUpdate = true
        }

        function onCompositionEnd() {
            state.dontUpdate = false
            flushChanges()
        }

        function onBlur() {
            state.isMouseDown = false
            state.lastRange = getCurrentRange()
            window.getSelection().removeAllRanges()
        }

        function onFocus() {
            if (state.lastRange) {
                state.lastRange.collapse()
                setCurrentRange(state.lastRange)
                state.lastRange = null
            }
            else {
                const lastText = lastTextDescendant(element)
                if (lastText) {
                    const range = document.createRange()
                    const content = lastText.textContent

                    // Don't include the invisible (but apparently required) '\n' at the end, otherwise:
                    //   On Safari: selection's BoundingBox is off by one character to the right
                    const offset = content.endsWith('\n') ? content.length - 1 : content.length

                    range.setStart(lastText, offset)
                    setCurrentRange(range)
                }
            }
        }

        function onMouseDown() {
            state.isMouseDown = true
        }

        function onMousePositionCaret(event: MouseEvent) {
            // The editable likely got created by a mousedown. We didn't see the
            // mousedown itself and want to set the mouse position
            const emptyOrOwnSelection = (
                document.getSelection().rangeCount === 0
                || element.contains(document.getSelection().getRangeAt(0).startContainer)
            )
            if (
                !state.isMouseDown
                && emptyOrOwnSelection
                && (event.type === 'mouseup' || event.buttons & 1)
            ) {
                if (document.caretRangeFromPoint) {
                    setCurrentRange(document.caretRangeFromPoint(event.clientX, event.clientY))
                }
                else if ((document as any).caretPositionFromPoint) {
                    const caretPosition = (document as any).caretPositionFromPoint(event.clientX, event.clientY)
                    const range = document.createRange()
                    range.setStart(caretPosition.offsetNode, caretPosition.offset)
                    setCurrentRange(range)
                }
            }
        }

        function onMouseUp(event: MouseEvent) {
            onMousePositionCaret(event)
            state.isMouseDown = false
        }

        element.addEventListener('keydown', onKeyDown)
        element.addEventListener('paste', onPaste)
        element.addEventListener('compositionstart', onCompositionStart)
        element.addEventListener('compositionend', onCompositionEnd)
        element.addEventListener('blur', onBlur)
        element.addEventListener('focus', onFocus)
        element.addEventListener('mousedown', onMouseDown)
        element.addEventListener('mousemove', onMousePositionCaret)
        element.addEventListener('mouseup', onMouseUp)

        return () => {
            element.removeEventListener('keydown', onKeyDown)
            element.removeEventListener('paste', onPaste)
            element.removeEventListener('compositionstart', onCompositionStart)
            element.removeEventListener('compositionend', onCompositionEnd)
            element.removeEventListener('blur', onBlur)
            element.removeEventListener('focus', onFocus)
            element.removeEventListener('mousedown', onMouseDown)
            element.removeEventListener('mousemove', onMousePositionCaret)
            element.removeEventListener('mouseup', onMouseUp)
        }
    }, [elementRef.current])

    // Restore editing state for user (observe edits and position)
    useLayoutEffect(() => {
        if (!elementRef.current) { return }

        state.observerDisconnected = false
        state.observer.observe(elementRef.current, observerSettings)

        if (state.positionToUpdateTo) {
            const { start, end } = state.positionToUpdateTo
            setCurrentRange(
                makeRange(elementRef.current, start, end)
            )
            state.positionToUpdateTo = null
        }

        return () => {
            // don't observe changes made by react
            state.observer.disconnect()
        }
    })

    return editable
}

function fixNonPlaintextKeyDown(event: KeyboardEvent, editable: Editable, element: HTMLElement) {
    // Fix backspace not working
    if (event.key === 'Backspace') {
        defaultBackspaceBehavior(event, editable, element)
    }
}

function defaultBackspaceBehavior(event: KeyboardEvent, editable: Editable, element: HTMLElement) {
    const position = getPosition(element)
    if (position.start !== position.end) {
        // delete selection
        editable.edit('', 0)
        event.preventDefault()
        event.stopPropagation()
    }
    else if (position.start === 0) {
        // Don't do anything, if the caret is at the beginning of the text.
        // Especially don't stop or prevent the event, so others still process this event.
        return
    }
    else {
        // default: delete one character
        let deleteCount = 1

        // delete word
        if (event.altKey) {
            const text = toString(element)
            const { lineBefore } = splitByPosition(text, position)
            const matchPreviousWord = /\S+\s*$/.exec(lineBefore)
            if (matchPreviousWord) {
                deleteCount = matchPreviousWord[0].length
            }
            else {
                deleteCount = lineBefore.length + 1
            }
        }

        // delete line
        else if (event.ctrlKey || event.metaKey) {
            const text = toString(element)
            const { lineBefore } = splitByPosition(text, position)
            deleteCount = lineBefore.length || 1
        }

        editable.edit('', -deleteCount)
        event.preventDefault()
        event.stopPropagation()
    }
}

function editableActions(
    elementRef: { current: HTMLElement | undefined | null },
    state: State,
    onChange: (text: string, position: SelRange<number>) => void,
): Editable {
    return {
        update(content: string, position?: SelRange<number>) {
            const { current: element } = elementRef
            if (!element) { return }

            const prevContent = toString(element)

            if (!position) {
                position = getPosition(element)
                const charDiffCount = content.length - prevContent.length
                position.start += charDiffCount
                position.end += charDiffCount
            }

            state.positionToUpdateTo = position
            onChange(content, position)
        },

        edit(append: string, deleteOffset: number = 0, editOffset: number = 0) {
            const { current: element } = elementRef
            if (!element) { return }

            // delete selection
            let range = getCurrentRange()
            if (!range) { return }
            range.deleteContents()
            range.collapse()

            // additionally delete `deleteOffset` chars around position
            const position = getPosition(element)
            const start = position.start + editOffset + (deleteOffset < 0 ? deleteOffset : 0)
            const end = position.start + editOffset + (deleteOffset > 0 ? deleteOffset : 0)
            range = makeRange(element, start, end)
            range.deleteContents()

            if (append) { range.insertNode(document.createTextNode(append))} 
            const caret = position.start + (deleteOffset < 0 ? deleteOffset : 0) + append.length
            setCurrentRange(makeRange(element, caret))
        },

        move(pos: number | { row: number; column: number}, extent: number = 0) {
            const { current: element } = elementRef
            if (!element) { return }

            element.focus()
            let position = 0
            if (typeof pos === 'number') {
                position = pos
            }
            else {
                if (pos.row > 0) {
                    const lines = toString(element).split('\n').slice(0, pos.row)
                    position += lines.join('\n').length + 1
                }
                position += pos.column
            }

            setCurrentRange(makeRange(element, position, position + extent))
        },

        getState() {
            const { current: element } = elementRef
            if (!element) {
                return {
                    text: '',
                    position: {
                        start: 0,
                        end: 0,
                    },
                }
            }

            const text = toString(element)
            const position = getPosition(element)
            return { text, position }
        },
    }
}

function rewindMutations(mutations: MutationRecord[]) {
    for (const mutation of [...mutations].reverse()) {
        if (mutation.oldValue !== null) {
            mutation.target.textContent = mutation.oldValue
        }
        for (let i = mutation.removedNodes.length - 1; i >= 0; i--) {
            mutation.target.insertBefore(
                mutation.removedNodes[i],
                mutation.nextSibling,
            )
        }
        for (let i = mutation.addedNodes.length - 1; i >= 0; i--) {
            if (mutation.addedNodes[i].parentNode) {
                mutation.target.removeChild(mutation.addedNodes[i])
            }
        }
    }
}


export function changeLinesContainingSelection(
    editable: Editable,
    changeLines: (lines: string[], startOffset: number, endOffset: number) => string[],
) {
    const { text, position } = editable.getState()
    const splitText = splitByPosition(text, position)
    const positionRowCol = selRangeToRowCol(text, position)

    const selectionContainingLines = (splitText.lineBefore + splitText.selection + splitText.lineAfter).split('\n')
    const changed = changeLines(selectionContainingLines, positionRowCol.start.col, positionRowCol.end.col)

    const startDiff = changed[0].length - selectionContainingLines[0].length
    const endRowDiff = changed.length - selectionContainingLines.length
    const endColDiff = (
        positionRowCol.end.col === 0 ?
            0
        :
            changed.slice(-1)[0].length - selectionContainingLines.slice(-1)[0].length
    )

    const outdentedText = [
        ...splitText.linesBefore,
        ...changed,
        ...splitText.linesAfter,
    ].join('\n')

    positionRowCol.start.col += startDiff
    positionRowCol.end.row += endRowDiff
    positionRowCol.end.col += endColDiff
    const outdentedPosition = selRangeToPos(outdentedText, positionRowCol)

    editable.update(outdentedText, outdentedPosition)
}