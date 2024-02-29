import * as React from 'react'

import { focusWithKeyboard } from '../../utils/ui'

import { SheetLineRef, findFocused, findLineRefContaining } from './actions'


export function useSelection(refMap: Map<number, SheetLineRef>) {
    const [selectionAnchorIds, setSelectionAnchorIds] = React.useState<{ start: number, end: number } | null>(null)

    // Focus Handlers

    const onBlur = React.useCallback(function onBlur(ev: React.FocusEvent) {
        const isNewFocusOneOfMyLines = (
            Array.from(refMap.values())
                .some(lineRef =>
                    lineRef.getElement() === ev.relatedTarget
                )
        )
        if (!isNewFocusOneOfMyLines) {
            setSelectionAnchorIds(null)
        }
    }, [refMap, setSelectionAnchorIds])

    const onFocus = React.useCallback(function onFocus(ev: React.FocusEvent) {
        if (!(ev.target instanceof Node)) { return }

        setSelectionAnchorIds(selection => {
            if (!selection) { return selection }

            const target = findLineRefContaining(ev.target, refMap)
            if (!target) { return null }

            const [targetId, targetLine] = target
            if (targetLine.getVarInput().contains(ev.target)) { return null }
            if (targetLine.getInnerContainer().contains(ev.target)) { return null }

            return { ...selection, end: targetId }
        })
    }, [refMap, setSelectionAnchorIds])


    // Mouse Handlers

    // From which line.id did the mouse start dragging
    const mouseStartId = React.useRef<number | null>(null)

    const onMouseDown = React.useCallback(function onMouseDown(ev: React.MouseEvent) {
        if (!(ev.target instanceof Node)) { return }

        if (ev.shiftKey) {
            // Update selection and move focus
            const currentFocusId = findFocused(refMap)?.[0]
            if (currentFocusId === undefined) { return }

            const target = findLineRefContaining(ev.target, refMap)
            if (!target) { return }
            const [targetFocusId, targetLine] = target

            // Don't capture shift-click selection inside a line
            if (currentFocusId === targetFocusId && targetLine.getInnerContainer().contains(ev.target)) { return }

            focusWithKeyboard(targetLine.getElement(), { preventScroll: true })
            setSelectionAnchorIds(selection => ({
                start: selection?.start ?? currentFocusId,
                end: targetFocusId,
            }))
            ev.stopPropagation()
            ev.preventDefault()
        }
        else {
            // Reset selection and remember where the user started (probably
            // continues to drag and creates a selection)
            setSelectionAnchorIds(null)
            const target = findLineRefContaining(ev.target, refMap)
            if (target) {
                const [targetId, targetLine] = target
                mouseStartId.current = targetId

                // If the user didn't target the variable name input or the
                // inner block:
                // Prevent default action, which start selecting the text
                // contents, but still move the focus to the element.
                if (
                    !targetLine.getInnerContainer().contains(ev.target)
                    && !targetLine.getVarInput().contains(ev.target)
                ) {
                    focusWithKeyboard(targetLine.getElement(), { preventScroll: true })
                    ev.stopPropagation()
                    ev.preventDefault()
                }
            }
        }
    }, [refMap, mouseStartId, setSelectionAnchorIds])

    const onMouseMove = React.useCallback(function onMouseMove(ev: React.MouseEvent) {
        if (!(ev.buttons & 1)) { return }
        if (!(ev.target instanceof Node)) { return }

        const target = findLineRefContaining(ev.target, refMap)
        if (!target) { return }
        const [targetId, targetLine] = target

        setSelectionAnchorIds(selection => {
            // Start selecting (selection === null) only when we:
            // - started in some line (mouseStartId.current !== null)
            // - and moved to another line (mouseStartId.current !== targetId)
            if (!selection && (mouseStartId.current === null || mouseStartId.current === targetId)) {
                return null
            }

            // Queue action with setTimeout, so it doesn't trigger another React
            // update (because of .focus() -> FocusEvent Handlers) during this
            // update
            setTimeout(() => focusWithKeyboard(targetLine.getElement(), { preventScroll: true }))

            const startId = mouseStartId.current
            mouseStartId.current = null

            return {
                start: selection?.start ?? startId,
                end: targetId,
            }
        })
    }, [refMap, mouseStartId, setSelectionAnchorIds])

            
    return {
        selectionAnchorIds,
        setSelectionAnchorIds,
        selectionEventHandlers: {
            onBlur,
            onFocus,
            onMouseDown,
            onMouseMove,
        },
    }
}
