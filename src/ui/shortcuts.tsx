import * as React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { Map, OrderedMap, List, Set } from 'immutable'

import { intersperse } from '../utils'

// Fulfilled by both React.KeyboardEvent and the DOM's KeyboardEvent
interface KeyboardEvent {
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    altKey: boolean
    key: string
    code: string
}

// Keys that don't change with shift on all keyboard layouts
export const shiftStableKeysWithoutAlpha = [
    " ",
    "Tab",
    "Enter",
    "Backspace",
    "Delete",
    "Escape",
    "Arrow(Up|Down|Left|Right)",
    "Home",
    "End",
    "Page(Up|Down)",
]
export const shiftStableKeysWithoutAlphaRegex = new RegExp("^(" + shiftStableKeysWithoutAlpha.join('|') + ")$")

export const shiftStableKeys = [ "[A-Z]", ...shiftStableKeysWithoutAlpha ]
export const shiftStableKeysRegex = new RegExp("^(" + shiftStableKeys.join('|') + ")$")

export function getFullKey(event: KeyboardEvent, keymap?: KeyMap) {
    const keyRemapped = (
        keymap === undefined ?
            event.key
        :
            remapKey(keymap, event.code, event.shiftKey)
    )

    const keyName = keyRemapped.length > 1 ? keyRemapped : keyRemapped.toUpperCase()
    const shiftStable = shiftStableKeysRegex.test(keyName)
    return [
        (event.ctrlKey || event.metaKey) ? "C-" : "",
        shiftStable && event.shiftKey ? "Shift-" : "",
        event.altKey ? "Alt-" : "",
        keyName,
    ].join('')
}



export type Keybinding = [keys: string[], condition: Condition, description: string, action: () => void]
export type KeybindingGroup = { description?: string, bindings: Keybinding[] }
export type Keybindings = Array<KeybindingGroup>

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
    keymap?: KeyMap,
) {
    if (event.isPropagationStopped()) { return }
    if (!keys.includes(getFullKey(event, keymap))) { return }
    if (!checkCondition(condition, event.currentTarget === event.target, isAnInput(event.target))) { return }

    event.stopPropagation()
    event.preventDefault()
    action()
}


export function keybindingsHandler(
    bindings: Keybindings,
    keymap: KeyMap,
): (event: React.KeyboardEvent) => void {
    const bindingMap = bindings.reduceRight(
        (map, group) => (
            group.bindings.reduce(
                (map, binding) => (
                    binding[0].reduce(
                        (map, key) => map.set(key, binding) ,
                        map,
                    )
                ),
                map,
            )
        ),
        Map<string, Keybinding>(),
    )
    return function onKeyDown(event: React.KeyboardEvent) {
        const binding = bindingMap.get(getFullKey(event, keymap))
        if (binding !== undefined && checkCondition(binding[1], event.currentTarget === event.target, isAnInput(event.target))) {
            event.stopPropagation()
            event.preventDefault()
            binding[3]()
        }
    }
}


export function useKeybindingsHandler(
    bindings: Keybindings
): (event: React.KeyboardEvent) => void {
    const keymap = useKeymap()
    return React.useMemo(() => keybindingsHandler(bindings, keymap), [bindings])
}

export function filterBindings(bindings: Keybindings, isSelfFocused: boolean, isInputFocused: boolean) {
    return bindings
        .map(binding => ({
            ...binding,
            bindings: (
                binding.bindings.filter(([_keys, condition, _description, _action]) => {
            return checkCondition(condition, isSelfFocused, isInputFocused)
        })
            ),
        }))
}

export function filterShadowedBindings(bindings: Keybindings): Keybindings {
    function filterBinding(binding: Keybinding, existingBindings: Set<string>): Keybinding[] {
        const [keys, condition, description, action] = binding
        const filteredKeys = keys.filter(key => !existingBindings.contains(key))
        if (filteredKeys.length === 0) {
            return []
        }
        return [
            [filteredKeys, condition, description, action]
        ]
    }
    function filterHelper(bindings: List<KeybindingGroup>, existingBindings: Set<string>): List<KeybindingGroup> {
        if (bindings.isEmpty()) {
            return List()
        }

        const current = bindings.get(0)
            const filteredBindings = current.bindings.flatMap(binding =>
                filterBinding(binding, existingBindings)
            )
            const bindingsKeys = current.bindings.flatMap(([keys]) => keys)
            return (
                filterHelper(bindings.shift(), existingBindings.union(bindingsKeys))
                    .unshift({ ...current, bindings: filteredBindings })
            )
    }

    return filterHelper(List(bindings), Set()).toArray()
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

    const allBindings = React.useMemo(
        () => filterShadowedBindings(activeBindings.valueSeq().reverse().toArray().flat()),
        [activeBindings]
    )

    return (
        <GatherShortcutsContext.Provider value={reporters}>
            <ShortcutsContext.Provider value={allBindings}>
                {children}
            </ShortcutsContext.Provider>
        </GatherShortcutsContext.Provider>
    )
}


export function useShortcuts(bindings: Keybindings, active: boolean = true) {
    const id = React.useId()
    const { reportBindings, removeBindings } = React.useContext(GatherShortcutsContext)
    const onKeyDown = useKeybindingsHandler(bindings)

    React.useEffect(() => {
        if (!active) {
            removeBindings(id)
        }
        return () => {
            removeBindings(id)
        }
    }, [active])

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
    return bindings.flatMap(binding => binding.bindings)
}

export function ShortcutSuggestions({ flat, allbindings }: { flat: boolean, allbindings?: Keybindings }) {
    const activeBindings = useActiveBindings()
    const bindings = allbindings ?? activeBindings

    if (bindings.length === 0) { return null }

    if (flat) {
        return (
            <>
                {flattenBindings(bindings).map(binding => (
                    <KeybindingSuggestion key={JSON.stringify(binding[0])} binding={binding} />
                ))}
            </>
        )
    }

    return (
        <>
            {bindings.map(binding => (
                <GroupSuggestion key={binding.description} group={binding} />
            ))}
        </>
    )
}

function KeybindingSuggestion({ binding }: { binding: Keybinding }) {
    const [keys, _condition, description, action] = binding
    return (
        <div
            className="flex flex-row space-x-1 cursor-pointer hover:-translate-y-0.5 transition text-xs"
            onPointerDown={(event: React.PointerEvent) => {
                event.stopPropagation()
                event.preventDefault()
                action()
            }}
        >
            {intersperse<React.ReactNode>(
                <span>/</span>,
                keys.map(k => <KeyButtonContainer><KeyComposition key={k} shortcut={k} /></KeyButtonContainer>)
            )}
            <span className="ml-2 text-gray-700 whitespace-nowrap">{description}</span>
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
                            <td className="py-0.5 flex flex-row space-x-1 text-xs">
                                {intersperse(
                                    <span>/</span>,
                                    keys.map(k => <KeyButtonContainer><KeyComposition shortcut={k} /></KeyButtonContainer>)
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


export function KeyComposition({ shortcut, Key = KeySymbol }: { shortcut: string, Key?: React.FC<{ keyName: string }> }) {
    const parts = shortcut.split('-')
    const modifiers = parts.slice(0, -1)
    const char = parts.slice(-1)[0]

    return (
        <>
            {modifiers.map(k => <span><Key key={k} keyName={k === "C" ? "Cmd" : k} /></span>)}
            <span><Key keyName={char} /></span>
        </>
    )
}


export function KeyButton({ keyName, className }: { keyName: string, className?: string }) {
    return (
        <KeyButtonContainer className={className}>
            <KeySymbol keyName={keyName} />
        </KeyButtonContainer>
    )
}


export function KeyButtonContainer({ children, className = "" }: { children: React.ReactNode, className?: string }) {
    return (
        <div
            style={{
                display: "inline flex"
            }}
            className={`
                justify-center items-center text-center space-x-0.5
                px-1 rounded shadow shadow-gray-400
                font-mono
                ${className}
            `}
        >
            {children}
        </div>
    )
}


export function KeySymbol({ keyName }) {
    switch (keyName) {
        case "Shift":
            return "⇧"
        
        case "Cmd":
            return "⌘"

        case "Alt":
            return "⌥"

        case "Backspace":
            return <FontAwesomeIcon size="xs" className="text-gray-600" icon={solidIcons.faDeleteLeft} />

        case "Enter":
            return "⏎"

        case "ArrowUp":
            return <FontAwesomeIcon className="text-gray-600" icon={solidIcons.faCaretUp} />

        case "ArrowDown":
            return <FontAwesomeIcon className="text-gray-600" icon={solidIcons.faCaretDown} />

        case "ArrowLeft":
            return <FontAwesomeIcon className="text-gray-600" icon={solidIcons.faCaretLeft} />

        case "ArrowRight":
            return <FontAwesomeIcon className="text-gray-600" icon={solidIcons.faCaretRight} />

        case "Escape":
            return "esc"

        case " ":
            return "space"

        default:
            return keyName
    }
}



type KeyMap = Map<string, { shift: string, noshift: string }>

export function remapKey(keymap: KeyMap, code: string, isShiftPressed: boolean) {
    if (!keymap.has(code)) {
        return code
    }

    if (isShiftPressed) {
        return keymap.get(code).shift
    }
    else {
        return keymap.get(code).noshift
    }
}

function loadSavedKeymap(): [KeyMap, boolean] {
    try {
        const keyMapJson = localStorage.getItem("keyMap")
        if (keyMapJson === null) {
            return [Map(), false]
        }
        return [Map(JSON.parse(keyMapJson)) as KeyMap, true]
    }
    catch (e) {
        return [Map(), false]
    }
}

const KeymapContext = React.createContext<KeyMap>(Map())

export function useKeymap() {
    return React.useContext(KeymapContext)
}

export interface CollectorDialogProps {
    keyMap: KeyMap
    onCollectKey(event: React.KeyboardEvent): void
    onDone(): void
}

export interface CollectKeymapProps {
    children: React.ReactNode
    collectorDialog: React.FC<CollectorDialogProps>
}

const IGNORE_KEYS_COLLECT = [
    "Shift",
    "Meta",
    "Alt",
    "Control",
]

export function CollectKeymap({ children, collectorDialog: CollectorDialog }: CollectKeymapProps) {
    const [[keyMap, isComplete], setKeyMap] = React.useState<[KeyMap, boolean]>(loadSavedKeymap)

    if (isComplete) {
        return (
            <KeymapContext.Provider value={keyMap}>
                {children}
            </KeymapContext.Provider>
        )
    }

    function onCollectKey(event: React.KeyboardEvent) {
        if (IGNORE_KEYS_COLLECT.includes(event.key) || shiftStableKeysWithoutAlphaRegex.test(event.key)) {
            return
        }
        if (event.altKey || event.metaKey || event.ctrlKey) {
            return
        }

        event.stopPropagation()
        event.preventDefault()

        setKeyMap(([keyMap]) => [
            keyMap.update(
                event.code,
                ({ shift, noshift } = { shift: undefined, noshift: undefined }) => ({
                    shift: event.shiftKey ? event.key : shift,
                    noshift: event.shiftKey ? noshift : event.key,
                }),
            ),
            false,
        ])
    }

    function onDone() {
        setKeyMap(([keyMap]) => {
            localStorage.setItem('keyMap', JSON.stringify(keyMap.toObject()))
            return [keyMap, true]
        })
    }

    return <CollectorDialog keyMap={keyMap} onCollectKey={onCollectKey} onDone={onDone} />
}