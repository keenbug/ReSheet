import * as React from 'react'

import { OrderedMap } from 'immutable'

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
    reportBindings(id: ReporterId, bindings: Keybinding[]): void
    removeBindings(id: ReporterId): void
}

const dummyShortcutsReporter: ShortcutsReporter = {
    reportBindings() {},
    removeBindings() {},
}

const GatherShortcutsContext = React.createContext<ShortcutsReporter>(dummyShortcutsReporter)
const ShortcutsContext = React.createContext<Keybinding[]>([])

export function useActiveBindings() {
    return React.useContext(ShortcutsContext)
}


export interface GatherShortcutsProps {
    children: React.ReactNode
}

export function GatherShortcuts({ children }: GatherShortcutsProps) {
    const [activeBindings, setActiveBindings] = React.useState<OrderedMap<ReporterId, Keybinding[]>>(OrderedMap())

    const reporters = React.useMemo(() => ({
        reportBindings(id: ReporterId, bindings: Keybinding[]) {
            setActiveBindings(activeBindings => activeBindings.set(id, bindings))
        },

        removeBindings(id: ReporterId) {
            setActiveBindings(activeBindings => activeBindings.delete(id))
        },
    }), [])

    const allBindings = activeBindings.valueSeq().toArray().flat()

    return (
        <GatherShortcutsContext.Provider value={reporters}>
            <ShortcutsContext.Provider value={allBindings}>
                {children}
            </ShortcutsContext.Provider>
        </GatherShortcutsContext.Provider>
    )
}


export function useShortcuts(bindings: Keybinding[]) {
    const id = React.useId()
    const { reportBindings, removeBindings } = React.useContext(GatherShortcutsContext)
    const onKeyDown = React.useMemo(() => keybindingsHandler(bindings), [bindings])

    React.useEffect(() => {
        return () => {
            removeBindings(id)
        }
    }, [])

    const onFocus = React.useCallback(function onFocus(event: React.FocusEvent) {
        const wasSelfFocused = event.currentTarget === event.relatedTarget
        const isSelfFocused = event.currentTarget === event.target

        // report if we gained or lost focus
        const lostOrGainedFocus = wasSelfFocused || isSelfFocused
        // and ignore if focus switched between children
        const alreadyContainedFocus = event.currentTarget.contains(event.relatedTarget) // contains the element losing focus
        if (!lostOrGainedFocus && alreadyContainedFocus) { return }

        const newActiveBindings = filterBindings(bindings, isSelfFocused)
        reportBindings(id, newActiveBindings)
    }, [])

    const onBlur = React.useCallback(function onBlur(event: React.FocusEvent) {
        const isStillFocused = event.currentTarget.contains(event.relatedTarget) // contains the element receiving focus
        if (!isStillFocused) {
            removeBindings(id)
        }
    }, [])

    return {
        onKeyDown,
        onFocus,
        onBlur,
    }
}







export function ShortcutSuggestions({ className = "" }: { className: string }) {
    const bindings = useActiveBindings()
    if (bindings.length === 0) { return null }

    return (
        <div className={`flex flex-row justify-between px-0.5 space-x-4 ${className}`}>
            {bindings.map(([keys, _condition, description, action]) => (
                <div
                    className="flex flex-row space-x-1 cursor-pointer hover:-translate-y-0.5 transition"
                    onPointerDown={(event: React.PointerEvent) => {
                        event.stopPropagation()
                        event.preventDefault()
                        action()
                    }}
                >
                    {intersperse<React.ReactNode>(
                        <div className="text-xs">/</div>,
                        keys.map(k => <KeyComposition shortcut={k} />)
                    )}
                    <div className="ml-2 text-xs text-gray-700 whitespace-nowrap">{description}</div>
                </div>
            ))}
        </div>
    )
}


export function KeyComposition({ shortcut }: { shortcut: string }) {
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
                    font-mono ${className}
                `}
            >
                {symbol}
            </div>
        )
    }

    switch (keyName) {
        case "Shift":
            return Container("text-gray-900", "⇧")
        
        case "Cmd":
            return Container("text-sm text-gray-900", "⌘")

        case "Alt":
            return Container("text-sm text-gray-900", "⌥")

        case "Backspace":
            return Container("text-sm text-gray-900", "⌫")

        case "Enter":
            return Container("text-sm text-gray-900", "⏎")

        case "ArrowUp":
            return Container("text-xs text-gray-600", "⬆︎")

        case "ArrowDown":
            return Container("text-xs text-gray-600", "⬇︎")

        case "ArrowLeft":
            return Container("text-xs text-gray-600", "⬅︎")

        case "ArrowRight":
            return Container("text-xs text-gray-600", "➡︎")

        case "Escape":
            return Container("text-xs text-gray-900", "esc")

        default:
            return Container("text-xs text-gray-900", keyName)
    }
}