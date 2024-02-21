import React from "react"
import { useSyncRef } from "./hooks"

const MOVE_ANIMATION_MS = 300
const POSITION_TRANSITION = `${MOVE_ANIMATION_MS}ms ease-out`

export function FocusIndicator() {
    const [focusRect, movedBetweenSiblings] = useFocusRect()
    const [rectChanged, setRectChanged] = React.useState(false)

    React.useEffect(() => {
        setRectChanged(true)

        const hide = setTimeout(() => {
            setRectChanged(false)
        }, MOVE_ANIMATION_MS)

        return () => {
            clearTimeout(hide)
        }
    }, [focusRect])

    if (!focusRect) { return null }

    const visible = rectChanged && !movedBetweenSiblings
    return (
        <div
            className="border-4 border-blue-500/20 pointer-events-none"
            style={{
                opacity: visible ? 1 : 0,
                transition: [
                    "left " + POSITION_TRANSITION,
                    "top " + POSITION_TRANSITION,
                    "width " + POSITION_TRANSITION,
                    "height " + POSITION_TRANSITION,
                ].join(', '),
                position: "absolute",
                left: focusRect.left + 'px',
                top: focusRect.top + 'px',
                width: focusRect.width + 'px',
                height: focusRect.height + 'px',
            }}
            />
    )
}

function useFocusRect(): [rect: DOMRect | null, movedBetweenSiblings: boolean] {
    const [[rect, movedBetweenSiblings], setRect] = React.useState<[DOMRect | null, boolean]>([null, false])
    const rectRef = useSyncRef(rect)

    function updateRect(ev: FocusEvent) {
        setTimeout(() => {
            const [gainsFocus, loosesFocus] = (
                ev.type === 'focusin' ?
                    [ev.target, ev.relatedTarget]
                :
                    [ev.relatedTarget, ev.target]
            )
            if (gainsFocus === null || !(gainsFocus instanceof HTMLElement)) {
                if (rectRef.current !== null) {
                    setRect([null, false])
                }
                return
            }
            // Only show focus change between parent/child
            const gainsLoosesAreSiblings = (
                loosesFocus instanceof HTMLElement
                && gainsFocus instanceof HTMLElement
                && !gainsFocus.contains(loosesFocus)
                && !loosesFocus.contains(gainsFocus)
            )

            const newRect = gainsFocus.getBoundingClientRect()
            if (
                rectRef.current?.x === newRect.x
                && rectRef.current?.y === newRect.y
                && rectRef.current?.width === newRect.width
                && rectRef.current?.height === newRect.height
            ) {
                return
            }
            setRect([newRect, gainsLoosesAreSiblings])
        })
    }

    React.useEffect(() => {
        document.body.addEventListener('focusin', updateRect)
        document.body.addEventListener('focusout', updateRect)
        return () => {
            document.body.removeEventListener('focusin', updateRect)
            document.body.removeEventListener('focusout', updateRect)
        }
    }, [])

    return [rect, movedBetweenSiblings]
}