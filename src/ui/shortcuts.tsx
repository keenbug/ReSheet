import * as React from 'react'

import { List, Map } from 'immutable'

import { getFullKey } from './utils'
import { intersperse } from '../utils'


export type Keybinding = [keys: string[], condition: Condition, description: string, action: () => void]

export type Condition =
    | "none"
    | "selfFocused"
    | "!selfFocused"

export function checkCondition(condition: Condition, isSelfFocused: boolean) {
    switch (condition) {
        case "none":
            return true

        case "selfFocused":
            return isSelfFocused

        case "!selfFocused":
            return !isSelfFocused
    }
}


export function onFullKey(
    event: React.KeyboardEvent,
    keys: string[],
    condition: Condition,
    action: () => void,
) {
    if (event.isPropagationStopped()) { return }
    if (!keys.includes(getFullKey(event))) { return }
    if (!checkCondition(condition, event.currentTarget === event.target)) { return }

    event.stopPropagation()
    event.preventDefault()
    action()
}


export function keybindingsHandler(
    bindings: Keybinding[]
): (event: React.KeyboardEvent) => void {
    return function onKeyDown(event: React.KeyboardEvent) {
        bindings.forEach(([keys, condition, _description, action]) => {
            onFullKey(event, keys, condition, action)
        })
    }
}

export function filterBindings(bindings: Keybinding[], isSelfFocused: boolean) {
    return bindings.filter(([_keys, condition, _description, _action]) => checkCondition(condition, isSelfFocused))
}




export type ReporterId = string

export type ShortcutsReporter = {
    reportTrail(trail: List<ReporterId>): void
    reportBindings(id: ReporterId, bindings: Keybinding[]): void
    removeBindings(id: ReporterId): void
}

const dummyShortcutsReporter: ShortcutsReporter = {
    reportTrail() {},
    reportBindings() {},
    removeBindings() {},
}

const ShortcutsContext = React.createContext<ShortcutsReporter>(dummyShortcutsReporter)




export function GatherShortcuts({ children }: { children: (bindings: Keybinding[]) => React.ReactNode }) {
    const [activeBindings, setActiveBindings] = React.useState<Map<ReporterId, Keybinding[]>>(Map())
    const [trail, setTrail] = React.useState<ReporterId[]>([])
    const allBindings = trail.map(id => activeBindings.get(id) ?? []).flat()

    function reportTrail(trail: List<ReporterId>) {
        setTrail(trail.toArray())
    }

    function reportBindings(id: ReporterId, bindings: Keybinding[]) {
        setActiveBindings(activeBindings => activeBindings.set(id, bindings))
    }

    function removeBindings(id: ReporterId) {
        setActiveBindings(activeBindings => activeBindings.delete(id))
    }

    return (
        <ShortcutsContext.Provider value={{ reportTrail, reportBindings, removeBindings }}>
            {children(allBindings)}
        </ShortcutsContext.Provider>
    )
}



export function useShortcuts(name: string, bindings: Keybinding[]) {
    const id = React.useId()
    const { reportTrail, reportBindings, removeBindings } = React.useContext(ShortcutsContext)
    const onKeyDown = keybindingsHandler(bindings)

    React.useEffect(() => {
        return () => {
            removeBindings(id)
        }
    }, [])

    function onFocusCapture(event: React.FocusEvent) {
        const wasSelfFocused = event.currentTarget === event.relatedTarget
        const isSelfFocused = event.currentTarget === event.target

        // report if we gained or lost focus
        const lostOrGainedFocus = wasSelfFocused || isSelfFocused
        // and ignore if focus switched between children
        const alreadyContainedFocus = event.currentTarget.contains(event.relatedTarget) // contains the element losing focus
        if (!lostOrGainedFocus && alreadyContainedFocus) { return }

        const newActiveBindings = filterBindings(bindings, isSelfFocused)
        reportBindings(id, newActiveBindings)

    }

    function onFocus(event: React.FocusEvent) {
        event.stopPropagation()
        reportTrail(List([id]))
    }

    function onBlur(event: React.FocusEvent) {
        const isStillFocused = event.currentTarget.contains(event.relatedTarget) // contains the element receiving focus
        if (!isStillFocused) {
            removeBindings(id)
        }
    }

    function childReportTrail(childTrail: List<ReporterId>) {
        reportTrail(childTrail.push(id))
    }

    return {
        onKeyDown,
        onFocus,
        onFocusCapture,
        onBlur,
        reporter: {
            reportTrail: childReportTrail,
            reportBindings,
            removeBindings,
        },
    }
}




export interface ShortcutsProps {
    name: string
    bindings: Keybinding[]
    className: string
    children: React.ReactNode
}

export const Shortcuts = React.forwardRef(
    function Shortcuts(
        { name, bindings, className, children }: ShortcutsProps,
        ref: React.Ref<HTMLDivElement>,
    ) {
        const shortcuts = useShortcuts(name, bindings)
        return (
            <div
                ref={ref}
                className={className}
                tabIndex={-1}
                onKeyDown={shortcuts.onKeyDown}
                onFocusCapture={shortcuts.onFocusCapture}
                onFocus={shortcuts.onFocus}
                onBlur={shortcuts.onBlur}
            >
                <ShortcutsContext.Provider value={shortcuts.reporter}>
                    {children}
                </ShortcutsContext.Provider>
            </div>
        )
    }
)






export function ViewShortcuts({ bindings, className = "" }: { bindings: Keybinding[], className: string }) {
    if (bindings.length === 0) { return null }

    return (
        <div className={`flex flex-row justify-between px-0.5 space-x-4 ${className}`}>
            {bindings.map(([keys, _condition, description, action]) => (
                <div
                    className="flex flex-row space-x-1 cursor-pointer hover:-translate-y-1 transition"
                    onPointerDown={(event: React.PointerEvent) => {
                        event.stopPropagation()
                        event.preventDefault()
                        action()
                    }}
                >
                    {intersperse<React.ReactNode>(
                        <div className="text-xs">/</div>,
                        keys.map(k => <ViewShortcut shortcut={k} />)
                    )}
                    <div className="ml-2 text-xs text-gray-700 whitespace-nowrap">{description}</div>
                </div>
            ))}
        </div>
    )
}


export function ViewShortcut({ shortcut }: { shortcut: string }) {
    if (shortcut === undefined) { return null }

    const parts = shortcut.split('-')
    const modifiers = parts.slice(0, -1)
    const char = parts.slice(-1)[0]


    return (
        <div className="flex flex-row space-x-px">
            {modifiers.map(k => <KeyButton key={k} keyName={k === "C" ? "Cmd" : k} />)}
            <KeyButton keyName={char} />
        </div>
    )
}


export function KeyButton({ keyName }) {
    function Container(className: string, symbol: string) {
        return (
            <div
                className={`
                    inline-block flex justify-center items-center text-center
                    h-4 px-1 rounded shadow shadow-gray-400 
                    text-gray-700 font-mono
                    ${className}
                `}
            >
                {symbol}
            </div>
        )
    }

    switch (keyName) {
        case "Shift":
            return Container("", "⇧")
        
        case "Cmd":
            return Container("text-sm", "⌘")

        case "Alt":
            return Container("text-sm", "⌥")

        case "Backspace":
            return Container("text-sm", "⌫")

        case "Enter":
            return Container("text-sm", "⏎")

        case "ArrowUp":
            return Container("text-xs", "⬆︎")

        case "ArrowDown":
            return Container("text-xs", "⬇︎")

        case "ArrowLeft":
            return Container("text-xs", "⬅︎")

        case "ArrowRight":
            return Container("text-xs", "➡︎")

        case "Escape":
            return Container("text-xs", "esc")

        default:
            return Container("text-xs", keyName)
    }
}