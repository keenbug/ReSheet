import * as React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { Map, OrderedMap, List, Set } from 'immutable'
import { debounce } from 'throttle-debounce'

import { intersperse } from '@resheet/util'

import { useStableCallback } from './hooks'

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
            remapKey(keymap, event.code, event.shiftKey, event.key)
    )

    const keyName = keyRemapped.length > 1 ? keyRemapped : keyRemapped.toUpperCase()
    const shiftStable = shiftStableKeysRegex.test(keyName)
    return [
        (event.ctrlKey || event.metaKey) ? "C-" : "",
        shiftStable && event.shiftKey ? "Shift-" : "",
        event.altKey ? "Alt-" : "",
        keyName === ' ' ? 'Space' : keyName,
    ].join('')
}



export type Keybinding = [keys: string[], condition: Condition, description: string, action: (event?: React.KeyboardEvent) => void, options?: KeybindingOptions]
export interface KeybindingOptions {
    noAutoPrevent?: boolean
}
export type KeybindingGroup = { description?: string, bindings: Keybinding[] }
export type Keybindings = Array<KeybindingGroup>

export type Condition =
    | "none"
    | "selfFocused"
    | "!selfFocused"
    | "!inputFocused"
    | "hidden"

export function checkCondition(condition: Condition, isSelfFocused: boolean, isInputFocused: boolean) {
    switch (condition) {
        case "none":
        case "hidden":
            return true

        case "selfFocused":
            return isSelfFocused

        case "!selfFocused":
            return !isSelfFocused

        case "!inputFocused":
            return !isInputFocused
    }
}

export function isAnInput(value: any) {
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
    action: (event: KeyboardEvent) => void,
    keymap?: KeyMap,
    options: KeybindingOptions = {},
) {
    if (event.isPropagationStopped()) { return }
    if (!keys.includes(getFullKey(event, keymap))) { return }
    if (!checkCondition(condition, event.currentTarget === event.target, isAnInput(event.target))) { return }

    action(event)
    if (!options.noAutoPrevent) {
        event.stopPropagation()
        event.preventDefault()
    }
}


export function keybindingsHandler(
    bindings: Keybindings,
    keymap: KeyMap,
): (event: React.KeyboardEvent) => void {
    const flatBindings = (
        bindings.flatMap(group =>
            group.bindings.flatMap(binding =>
                binding[0].map(key => [key, binding] as [string, Keybinding])
            )
        )
    )
    const bindingMap = flatBindings.reduce(
        (map, [key, binding]) => (
            map.update(key, List(), l => l.push(binding))
        ),
        Map<string, List<Keybinding>>(),
    )
    return function onKeyDown(event: React.KeyboardEvent) {
        const bindings = bindingMap.get(getFullKey(event, keymap))
        if (bindings !== undefined) {
            for (const binding of bindings) {
                if (checkCondition(binding[1], event.currentTarget === event.target, isAnInput(event.target))) {
                    binding[3](event)
                    if (!binding[4]?.noAutoPrevent) {
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return
                }
            }
        }
    }
}


export function useKeybindingsHandler(
    bindings: Keybindings
): (event: React.KeyboardEvent) => void {
    const keymap = useKeymap()
    return React.useMemo(() => keybindingsHandler(bindings, keymap), [bindings, keymap])
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
    updateBindings(id: ReporterId, bindings: Keybindings): void
    reportBindings(id: ReporterId, bindings: Keybindings): void
    removeBindings(id: ReporterId): void
}

const dummyShortcutsReporter: ShortcutsReporter = {
    updateBindings() {},
    reportBindings() {},
    removeBindings() {},
}

type NotificationConsumer = () => void
type NotificationConsumerId = string

type ShortcutsNotifier = {
    getBindings(): Keybindings
    subscribe(id: NotificationConsumerId, consumer: NotificationConsumer): void
    unsubscribe(id: NotificationConsumerId): void
}

const dummyShortcutsNotifier: ShortcutsNotifier = {
    getBindings() { return [] },
    subscribe(id, consumer) {},
    unsubscribe(id) {},
}

const ShortcutsReporterContext = React.createContext<ShortcutsReporter>(dummyShortcutsReporter)
const ShortcutsNotifierContext = React.createContext<ShortcutsNotifier>(dummyShortcutsNotifier)

export function useBindingNotifications() {
    return React.useContext(ShortcutsNotifierContext)
}

export function useSubscribeBindings(consumer: (bindings: Keybindings) => void) {
    const { getBindings, subscribe, unsubscribe } = useBindingNotifications()
    const id = React.useId()

    React.useEffect(() => {
        subscribe(id, () => { consumer(getBindings()) })
        return () => {
            unsubscribe(id)
        }
    }, [consumer])
}

export function useActiveBindings() {
    const { getBindings, subscribe, unsubscribe } = useBindingNotifications()
    const id = React.useId()
    const [cachedBindings, setCachedBindings] = React.useState(getBindings)

    React.useEffect(() => {
        subscribe(id, () => { setCachedBindings(getBindings()) })
        return () => {
            unsubscribe(id)
        }
    }, [])

    return cachedBindings
}


export interface GatherShortcutsProps {
    children: React.ReactNode
}

export function GatherShortcuts({ children }: GatherShortcutsProps) {
    const activeBindings = React.useRef<OrderedMap<ReporterId, Keybindings>>(OrderedMap())
    const bindingUpdateNotificationConsumers = React.useRef<Map<NotificationConsumerId, NotificationConsumer>>(Map())

    const notifyUpdate = React.useMemo(() => debounce(100, () => {
        bindingUpdateNotificationConsumers.current.valueSeq().forEach(consumer => consumer())
    }), [])

    const reporters = React.useMemo(() => ({
        updateBindings(id: ReporterId, bindings: Keybindings) {
            activeBindings.current = activeBindings.current.set(id, bindings)
            notifyUpdate()
        },

        reportBindings(id: ReporterId, bindings: Keybindings) {
            activeBindings.current = activeBindings.current.delete(id).set(id, bindings) // delete first to change the order
            notifyUpdate()
        },

        removeBindings(id: ReporterId) {
            activeBindings.current = activeBindings.current.delete(id)
            notifyUpdate()
        },
    }), [])

    const notifier: ShortcutsNotifier = React.useMemo(() => ({
        getBindings() {
            return filterShadowedBindings(activeBindings.current.valueSeq().toArray().flat())
        },

        subscribe(id: NotificationConsumerId, consumer: NotificationConsumer) {
            bindingUpdateNotificationConsumers.current = bindingUpdateNotificationConsumers.current.set(id, consumer)
        },

        unsubscribe(id: NotificationConsumerId) {
            bindingUpdateNotificationConsumers.current = bindingUpdateNotificationConsumers.current.delete(id)
        },
    }), [])

    return (
        <ShortcutsReporterContext.Provider value={reporters}>
            <ShortcutsNotifierContext.Provider value={notifier}>
                {children}
            </ShortcutsNotifierContext.Provider>
        </ShortcutsReporterContext.Provider>
    )
}


export function useShortcuts(bindings: Keybindings, active: boolean = true) {
    const id = React.useId()
    const { updateBindings, reportBindings, removeBindings } = React.useContext(ShortcutsReporterContext)
    const onKeyDownUnstable = useKeybindingsHandler(bindings)
    const onKeyDown = useStableCallback(onKeyDownUnstable)
    const focusRef = React.useRef<{ isSelfFocused: boolean, isAnInputFocused: boolean }>(null)

    React.useEffect(() => {
        if (!active) {
            removeBindings(id)
        }
        return () => {
            removeBindings(id)
        }
    }, [active])

    React.useEffect(() => {
        if (focusRef.current && active) {
            const activeBindings = filterBindings(bindings, focusRef.current.isSelfFocused, focusRef.current.isAnInputFocused)
            updateBindings(id, activeBindings)
        }
    }, [bindings, active])

    const onFocus = useStableCallback(function onFocus(event: React.FocusEvent) {
        const isSelfFocused = event.currentTarget === event.target
        const isAnInputFocused = isAnInput(event.target)
        focusRef.current = {
            isSelfFocused,
            isAnInputFocused,
        }

        const newActiveBindings = filterBindings(bindings, isSelfFocused, isAnInputFocused)
        active && reportBindings(id, newActiveBindings)
    })

    const onBlur = React.useCallback(function onBlur(event: React.FocusEvent) {
        const isStillFocused = event.currentTarget.contains(event.relatedTarget) // contains the element receiving focus
        if (!isStillFocused) {
            focusRef.current = null
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
    const [keys, condition, description, action] = binding
    if (condition === 'hidden') { return null }
    return (
        <div
            className="flex flex-row space-x-1 cursor-pointer hover:-translate-y-0.5 transition text-xs"

            // prevent changing focus
            onPointerDown={ev => ev.preventDefault()}
            onClick={() => action()}
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
        <div className="space-y-2">
            {group.description && <div className="text-xs font-medium">{group.description}</div>}
            <table>
                <tbody>
                    {group.bindings.map(([keys, condition, description, action]) => (
                        condition !== 'hidden' &&
                        <tr
                            className="cursor-pointer hover:-translate-x-0.5 transition"

                            // prevent changing focus
                            onPointerDown={ev => ev.preventDefault()}
                            onClick={() => action()}
                        >
                            <td className="py-0.5 flex flex-row space-x-1 text-xs">
                                {keys.flatMap((k, index) => [
                                    <span key={index}>/</span>,
                                    <KeyButtonContainer><KeyComposition shortcut={k} /></KeyButtonContainer>,
                                ]).slice(1)}
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
            {modifiers.map(k => <kbd key={k} className="font-sans"><Key keyName={k === "C" ? "Cmd" : k} /></kbd>)}
            <kbd className="font-sans"><Key keyName={char} /></kbd>
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
        <kbd
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
        </kbd>
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



export type KeyMap = Map<string, { shift: string, noshift: string }>

export function remapKey(keymap: KeyMap, code: string, isShiftPressed: boolean, fallbackKey: string) {
    if (!keymap.has(code)) {
        return fallbackKey
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

export interface CollectorUiProps {
    keyMap: KeyMap
    onCollectKey(event: React.KeyboardEvent): void
    onDone(): void
}

export interface CollectKeymapProps {
    children: React.ReactNode
    collectorUi: React.FC<CollectorUiProps>
}

const IGNORE_KEYS_COLLECT = [
    "Shift",
    "Meta",
    "Alt",
    "Control",
]

export function CollectKeymap({ children, collectorUi: CollectorUi }: CollectKeymapProps) {
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

    return (
        <>
            {children}
            <CollectorUi keyMap={keyMap} onCollectKey={onCollectKey} onDone={onDone} />
        </>
    )
}