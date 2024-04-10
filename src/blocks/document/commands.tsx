import * as React from 'react'

import { intersperse } from '@resheet/util'
import { useEffectQueue } from '@resheet/util/hooks'

import { KeyComposition, Keybindings, ShortcutSuggestions, useKeybindingsHandler, KeyButtonContainer, KeyButton } from '@resheet/util/shortcuts'
import { renderMatch, useSearchResults } from '@resheet/util/search'


export function CommandSearch({ bindings, close }: { bindings: Keybindings, close(): void }) {
    const inputRef = React.useRef<HTMLInputElement>()
    const focusBefore = React.useMemo(() => document.activeElement, [])
    const [searchText, setSearchText] = React.useState('')
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

    const { setRef, results, selected, moveSelection, select } = (
        useSearchResults(searchText, flatBindings, binding => binding.description)
    )

    function runBindingAndClose(filteredIndex: number) {
        if (results[filteredIndex] !== undefined) {
            close()
            if (focusBefore instanceof HTMLElement) {
                focusBefore.focus()
            }
            results[filteredIndex].candidate.action()
        }
    }

    function runBinding(filteredIndex: number) {
        if (results[filteredIndex] !== undefined) {
            results[filteredIndex].candidate.action()
            queueEffect(() => { inputRef.current?.focus() })
        }
    }

    function dismiss() {
        if (searchText === '') {
            close()
            if (focusBefore instanceof HTMLElement) {
                focusBefore.focus()
            }
        }
        else {
            setSearchText('')
        }
    }

    const localBindings: Keybindings = [
        {
            bindings: [
                [['ArrowUp', 'C-P'],   'none', "prev result",  () => { moveSelection(-1) }],
                [['ArrowDown', 'C-N'], 'none', "next result",  () => { moveSelection(1) }],
            ]
        },
        {
            bindings: [
                [['Enter'],            'none', "run & close", () => { runBindingAndClose(selected) }],
                [['Alt-Enter'],        'none', "run",         () => { runBinding(selected) }],
            ]
        },
        {
            bindings: [
                [['Escape'],           'none', "dismiss",      () => { dismiss() }],
            ]
        },
    ]

    const handleKeybindings = useKeybindingsHandler(localBindings)

    function onClickDismiss(ev: React.MouseEvent) {
        if (ev.currentTarget === ev.target) {
            dismiss()
        }
    }

    return (
        <div className="absolute z-50 inset-0 h-full bg-gray-300/30 py-10 px-2 overflow-hidden" onClick={onClickDismiss}>
            <div className="w-full md:w-2/3 mx-auto max-h-full overflow-auto shadow-xl border border-gray-200 bg-white rounded-lg min-h-0 flex flex-col items-stretch">
                <input
                    ref={inputRef}
                    type="text"
                    autoFocus
                    placeholder="Search commands"
                    className="p-5 bg-transparent focus:outline-none border-b border-gray-200"
                    value={searchText}
                    onChange={ev => setSearchText(ev.target.value)}
                    onKeyDown={handleKeybindings}
                    />
                <div className="overflow-y-auto flex flex-col">
                    {results.length === 0 && (
                        <div className="text-gray-700 px-5 py-3">No results for the current focus</div>
                    )}
                    {results.map((result, index) => (
                        <div
                            ref={setRef(result.id)}
                            key={result.id}
                            className={`
                                flex flex-row space-x-3 justify-start items-baseline px-5 py-3 border-b border-gray-300
                                cursor-pointer text-left ${index === selected && "bg-gray-200"}
                            `}
                            onPointerEnter={() => select(index)}
                            onClick={() => { runBindingAndClose(index) }}
                        >
                            <span className="text-gray-500 text-sm">
                                {result.candidate.group}
                            </span>
                            <span>
                                {renderMatch(result.match)}
                            </span>
                            {index === selected && <KeyButton className="text-sm" keyName="Enter" />}

                            <div className="flex-1 flex flex-row justify-end space-x-1 text-sm">
                                {intersperse(
                                    <span>/</span>,
                                    result.candidate.keys.map(k => <KeyButtonContainer><KeyComposition shortcut={k} /></KeyButtonContainer>)
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex flex-row items-center justify-between h-8 space-x-6 px-5 py-1 border-t border-gray-200 bg-gray-100 overflow-x-auto">
                    <ShortcutSuggestions flat={true} allbindings={localBindings} />
                </div>
            </div>
        </div>
    )
}
