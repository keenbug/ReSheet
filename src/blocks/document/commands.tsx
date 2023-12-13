import * as React from 'react'

import { intersperse } from '../../utils'
import { KeyButton, KeyComposition, Keybindings, ShortcutSuggestions, useKeybindingsHandler } from '../../ui/shortcuts'

import { useEffectQueue, useEffectfulUpdate, useRefMap } from '../../ui/hooks'


type Match = [prefix: string, match: string][]

function fuzzyMatch(search: string, text: string): null | Match {
    if (search.length === 0) {
        return [[text, '']]
    }

    const matchStart = text.indexOf(search[0])
    if (matchStart < 0) {
        return null
    }

    const prefix = text.slice(0, matchStart)
    const textFromMatch = text.slice(matchStart)
    const maxMatchLength = Math.min(search.length, textFromMatch.length)
    let matchLength = 1
    while (matchLength < maxMatchLength && search[matchLength] === textFromMatch[matchLength]) {
        matchLength++
    }
    const fullMatch = textFromMatch.slice(0, matchLength)
    const restText = textFromMatch.slice(matchLength)
    const restSearch = search.slice(matchLength)

    const restMatch = fuzzyMatch(restSearch, restText)
    if (restMatch === null) {
        return null
    }

    return [
        [prefix, fullMatch],
        ...restMatch,
    ]
}

function renderMatch(match: Match) {
    return match.map(([prefix, match]) => (
        <>{prefix}<b>{match}</b></>
    ))
}

function rankMatch(match: Match): number {
    const joinedMatch = match.map(([_prefix, match]) => match).join('')
    const joinedFull = match.flat().join('')
    const matchRatio = joinedMatch.length / joinedFull.length
    
    const wordFit = match
        .map(
            ([prefix, match]) => (
                prefix.length === 0 || prefix.endsWith(" ") ?  0.8
                : match.includes(" ") ?  0.9
                : 1
            )
        )
        .reduce((a, b) => a + b, 0)

    return wordFit * (2 - matchRatio)
}

export function CommandSearch({ bindings, close }: { bindings: Keybindings, close(): void }) {
    const inputRef = React.useRef<HTMLInputElement>()
    const [searchText, setSearchText] = React.useState('')
    const [activeBinding, setActiveBinding] = React.useState(0)
    const [setResultRef, refMap] = useRefMap<number, HTMLDivElement>()
    const updateActiveBinding = useEffectfulUpdate(setActiveBinding)
    const queueEffect = useEffectQueue()

    const flatBindings = (
        bindings
            .flatMap(binding =>
                binding.bindings.map(([keys, _condition, description, action]) => (
                    { group: binding.description, keys, description, action }
                ))
            )
            .map((binding, index) => ({ ...binding, id: index }))
    )

    const filteredBindings = flatBindings
        .flatMap(binding => {
            const match = fuzzyMatch(searchText, binding.description)
            if (match === null) {
                return []
            }
            return [
                { ...binding, description: match }
            ]
        })
        .sort((a, b) => rankMatch(a.description) - rankMatch(b.description))

    function scrollToFocus(filteredIndex: number) {
        refMap.get(filteredBindings[filteredIndex]?.id)?.scrollIntoView({ block: 'nearest' })
    }

    function moveActiveBinding(delta: number) {
        updateActiveBinding(current => {
            const newActive = (
                (current + delta + /* so we don't get negative values: */ filteredBindings.length)
                % filteredBindings.length
            )
            return {
                state: newActive,
                effect() { scrollToFocus(newActive) },
            }
        })
    }

    function onChange(event: React.ChangeEvent<HTMLInputElement>) {
        setSearchText(event.target.value)
        updateActiveBinding(() => ({
            state: 0,
            effect() { scrollToFocus(0) },
        }))
    }

    function runBindingAndClose(filteredIndex: number) {
        if (filteredBindings[filteredIndex] !== undefined) {
            close()
            filteredBindings[filteredIndex].action()
        }
    }

    function runBinding(filteredIndex: number) {
        if (filteredBindings[filteredIndex] !== undefined) {
            filteredBindings[filteredIndex].action()
            queueEffect(() => { inputRef.current?.focus() })
        }
    }

    function dismiss() {
        if (searchText === '') {
            close()
        }
        else {
            setSearchText('')
        }
    }

    const localBindings: Keybindings = [
        {
            bindings: [
                [['ArrowUp', 'C-P'],   'none', "prev result",  () => { moveActiveBinding(-1) }],
                [['ArrowDown', 'C-N'], 'none', "next result",  () => { moveActiveBinding(1) }],
            ]
        },
        {
            bindings: [
                [['Enter'],            'none', "run & close", () => { runBindingAndClose(activeBinding) }],
                [['Alt-Enter'],        'none', "run",         () => { runBinding(activeBinding) }],
            ]
        },
        {
            bindings: [
                [['Escape'],           'none', "dismiss",      () => { dismiss() }],
            ]
        },
    ]

    const handleKeybindings = useKeybindingsHandler(localBindings)

    return (
        <div className="absolute inset-0 h-full bg-gray-300/30 py-10 overflow-hidden">
            <div className="w-2/3 mx-auto max-h-full overflow-scroll shadow-xl border border-gray-200 bg-white rounded-lg min-h-0 flex flex-col items-stretch">
                <input
                    ref={inputRef}
                    type="text"
                    autoFocus
                    placeholder="Search commands"
                    className="p-5 bg-transparent focus:outline-none border-b border-gray-200"
                    value={searchText}
                    onChange={onChange}
                    onKeyDown={handleKeybindings}
                    />
                <div className="overflow-y-scroll flex flex-col">
                    {filteredBindings.length === 0 && (
                        <div className="text-gray-700 px-5 py-3">No results</div>
                    )}
                    {filteredBindings.map((binding, index) => (
                        <div
                            ref={setResultRef(binding.id)}
                            key={binding.id}
                            className={`
                                flex flex-row space-x-3 justify-start items-baseline px-5 py-3 border-b border-gray-300
                                text-left ${index === activeBinding && "bg-gray-200"}
                            `}
                            onPointerMove={event => { if (event.movementX > 0 || event.movementY > 0) { setActiveBinding(index)  }}}
                            onClick={() => { runBindingAndClose(index) }}
                        >
                            <span className="text-gray-500 text-sm">
                                {binding.group}
                            </span>
                            <span>
                                {renderMatch(binding.description)}
                            </span>
                            {index === activeBinding && <KeyButton keyName="Enter" />}

                            <div className="flex-1 flex flex-row justify-end space-x-1">
                                {intersperse(
                                    <div className="text-xs">/</div>,
                                    binding.keys.map(k => <KeyComposition shortcut={k} />)
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <ShortcutSuggestions flat={true} allbindings={localBindings} className="px-5 py-1 border-t border-gray-200 bg-gray-100" />
            </div>
        </div>
    )
}
