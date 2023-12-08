import * as React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { OrderedMap } from 'immutable'

import { getFullKey } from './utils'
import { intersperse } from '../utils'


export type Keybinding = [keys: string[], condition: Condition, description: string, action: () => void]
export type KeybindingGroup = { description?: string, bindings: Keybinding[] }
export type Keybindings = Array<Keybinding | KeybindingGroup>

export type Condition =
    | "none"
    | "selfFocused"
    | "!selfFocused"
    | "!inputFocused"

export function checkCondition(condition: Condition, isSelfFocused: boolean, isInputFocused: boolean) {
    switch (condition) {
        case "none":
            return true

        case "selfFocused":
            return isSelfFocused

        case "!selfFocused":
            return !isSelfFocused

        case "!inputFocused":
            return !isInputFocused
    }
}

function isAnInput(value: any) {
    return (
        value instanceof HTMLTextAreaElement
        || value instanceof HTMLInputElement
        || (value instanceof HTMLElement && value.isContentEditable)
    )
}

export function onFullKey(
    event: React.KeyboardEvent,
    keys: string[],
    condition: Condition,
    action: () => void,
) {
    if (event.isPropagationStopped()) { return }
    if (!keys.includes(getFullKey(event))) { return }
    if (!checkCondition(condition, event.currentTarget === event.target, isAnInput(event.target))) { return }

    event.stopPropagation()
    event.preventDefault()
    action()
}


export function keybindingsHandler(
    bindings: Keybindings
): (event: React.KeyboardEvent) => void {
    return function onKeyDown(event: React.KeyboardEvent) {
        bindings.forEach(binding => {
            if (Array.isArray(binding)) {
                const [keys, condition, _description, action] = binding
                onFullKey(event, keys, condition, action)
            }
            else {
                binding.bindings.forEach(([keys, condition, _description, action]) => {
                    onFullKey(event, keys, condition, action)
                })
            }
        })
    }
}

export function filterBindings(bindings: Keybindings, isSelfFocused: boolean, isInputFocused: boolean) {
    return bindings
        .filter(binding => {
            if (!Array.isArray(binding)) {
                return true
            }
            const [_keys, condition, _description, _action] = binding
            return checkCondition(condition, isSelfFocused, isInputFocused)
        })
        .map(binding => {
            if (Array.isArray(binding)) {
                return binding
            }
            return {
                ...binding,
                bindings: filterBindings(binding.bindings, isSelfFocused, isInputFocused),
            }
        })
}




export type ReporterId = string

export type ShortcutsReporter = {
    reportBindings(id: ReporterId, bindings: Keybindings): void
    removeBindings(id: ReporterId): void
}

const dummyShortcutsReporter: ShortcutsReporter = {
    reportBindings() {},
    removeBindings() {},
}

const GatherShortcutsContext = React.createContext<ShortcutsReporter>(dummyShortcutsReporter)
const ShortcutsContext = React.createContext<Keybindings>([])

export function useActiveBindings() {
    return React.useContext(ShortcutsContext)
}


export interface GatherShortcutsProps {
    children: React.ReactNode
}

export function GatherShortcuts({ children }: GatherShortcutsProps) {
    const [activeBindings, setActiveBindings] = React.useState<OrderedMap<ReporterId, Keybindings>>(OrderedMap())

    const reporters = React.useMemo(() => ({
        reportBindings(id: ReporterId, bindings: Keybindings) {
            setActiveBindings(activeBindings => activeBindings.set(id, bindings))
        },

        removeBindings(id: ReporterId) {
            setActiveBindings(activeBindings => activeBindings.delete(id))
        },
    }), [])

    const allBindings = activeBindings.valueSeq().reverse().toArray().flat()

    return (
        <GatherShortcutsContext.Provider value={reporters}>
            <ShortcutsContext.Provider value={allBindings}>
                {children}
            </ShortcutsContext.Provider>
        </GatherShortcutsContext.Provider>
    )
}


export function useShortcuts(bindings: Keybindings) {
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

        const newActiveBindings = filterBindings(bindings, isSelfFocused, isAnInput(event.target))
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






function flattenBindings(bindings: Keybindings): Keybinding[] {
    return bindings.flatMap(binding => {
        if (Array.isArray(binding)) {
            return [binding]
        }
        return binding.bindings
    })
}

export function ShortcutSuggestions({ flat, className = "", allbindings }: { flat: boolean, className: string, allbindings?: Keybindings }) {
    const activeBindings = useActiveBindings()
    const bindings = allbindings ?? activeBindings

    if (bindings.length === 0) { return null }

    const flattenedBindings = flat ? flattenBindings(bindings) : bindings

    return (
        <div className={`flex flex-row justify-between space-x-20 ${className}`}>
            {flattenedBindings.map(binding => {
                if (Array.isArray(binding)) {
                    return <BindingSuggestion key={binding[2]} binding={binding} />
                }
                else {
                    return <GroupSuggestion key={binding.description} group={binding} />
                }
            })}
        </div>
    )
}

function BindingSuggestion({ binding }: { binding: Keybinding }) {
    const [keys, _condition, description, action] = binding
    return (
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
                keys.map(k => <KeyComposition key={k} shortcut={k} />)
            )}
            <div className="ml-2 text-xs text-gray-700 whitespace-nowrap">{description}</div>
        </div>
    )
}

function GroupSuggestion({ group }: { group: KeybindingGroup }) {
    if (group.bindings.length === 0) {
        return null
    }

    return (
        <div className="flex flex-col space-y-2">
            {group.description && <div className="text-xs font-medium">{group.description}</div>}
            <table>
                <tbody>
                    {group.bindings.map(([keys, _condition, description, action]) => (
                        <tr
                            className="cursor-pointer hover:-translate-x-0.5 transition"
                            onPointerDown={(event: React.PointerEvent) => {
                                event.stopPropagation()
                                event.preventDefault()
                                action()
                            }}
                        >
                            <td className="py-0.5 flex flex-row space-x-1">
                                {intersperse(
                                    <div className="text-xs">/</div>,
                                    keys.map(k => <KeyComposition shortcut={k} />)
                                )}
                            </td>
                            <td className="py-0.5 pl-2 text-xs text-gray-700 whitespace-nowrap">{description}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
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
    function Container(className: string, symbol: React.ReactNode) {
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
            return Container("text-lg text-gray-900", "⇧")
        
        case "Cmd":
            return Container("text-gray-900", "⌘")

        case "Alt":
            return Container("text-sm text-gray-900", "⌥")

        case "Backspace":
            return Container("text-gray-600", <FontAwesomeIcon size="2xs" icon={solidIcons.faDeleteLeft} />)

        case "Enter":
            return Container("text-gray-900", "⏎")

        case "ArrowUp":
            return Container("text-xs text-gray-600", <FontAwesomeIcon icon={solidIcons.faCaretUp} />)

        case "ArrowDown":
            return Container("text-xs text-gray-600", <FontAwesomeIcon icon={solidIcons.faCaretDown} />)

        case "ArrowLeft":
            return Container("text-xs text-gray-600", <FontAwesomeIcon icon={solidIcons.faCaretLeft} />)

        case "ArrowRight":
            return Container("text-xs text-gray-600", <FontAwesomeIcon icon={solidIcons.faCaretRight} />)

        case "Escape":
            return Container("text-xs text-gray-900", "esc")

        case " ":
            return Container("text-xs text-gray-900", "space")

        default:
            return Container("text-xs text-gray-900", keyName)
    }
}