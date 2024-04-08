import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'

import { Set } from 'immutable'

import { CollectorUiProps, KeyButton, KeyMap } from '@resheet/util/shortcuts'


type CollectorUiState = 'hidden' | 'bar' | 'dialog'

export function KeymapCollector(props: CollectorUiProps) {
    const [uiState, setUiState] = React.useState<CollectorUiState>('bar')

    switch (uiState) {
        case 'hidden':
        case 'bar':
            return <KeymapCollectorBar hidden={uiState === 'hidden'} onChangeUi={setUiState} />

        case 'dialog':
            return <KeymapCollectorDialog {...props} onCancel={() => setUiState('bar')} />
    }
}


function KeymapCollectorBar({ hidden, onChangeUi }: { hidden: boolean, onChangeUi(state: CollectorUiState): void }) {
    if (hidden) {
        return (
            <button
                className="absolute left-0 top-0 right-0 z-40 h-1.5 shadow shadow-amber-200 bg-amber-200 opacity-75 hover:opacity-100"
                onClick={() => onChangeUi('bar')}
                />
        )
    }

    return (
        <div className="absolute left-0 top-0 right-0 z-40 py-1 px-4 shadow bg-amber-200/75 hover:bg-amber-200 backdrop-blur-sm text-amber-950 text-center">
            <button onClick={() => onChangeUi('dialog')}>
                For shortcuts to work properly, please make a quick calibration here.
            </button>
            <button className="float-right hover:text-amber-600" onClick={() => onChangeUi('hidden')}>
                <FontAwesomeIcon icon={solidIcons.faXmark} />
            </button>
        </div>
    )
}


function KeymapCollectorDialog({ keyMap, onCollectKey, onDone, onCancel }: CollectorUiProps & { onCancel(): void }) {
    const [step, setStep] = React.useState<'explain' | 'noshift' | 'shift'>('explain')

    const keyboardVisRef = React.useRef<HTMLDivElement>()
    React.useEffect(() => {
        keyboardVisRef.current && keyboardVisRef.current.focus()
    }, [keyboardVisRef.current, step])


    const keyMapNotOnKeyboardVisualization = keyMap.filter((_value, key) => !KEYBOARD_CODES.includes(key))

    const noshiftMissing = keyMapNotOnKeyboardVisualization
        .valueSeq()
        .filter(({ noshift }) => !noshift)
        .map(({ shift }) => shift)
        .sort()
        .toArray()
    const shiftMissing = keyMapNotOnKeyboardVisualization
        .valueSeq()
        .filter(({ shift }) => !shift)
        .map(({ noshift }) => noshift)
        .sort()
        .toArray()

    const matches = keyMap.count() >= 40 && keyMap.every(({ shift, noshift }) => !!shift && !!noshift)

    function onClickDismiss(ev: React.MouseEvent) {
        if (ev.currentTarget === ev.target) {
            onCancel()
        }
    }

    function keepFocusOnBlur(ev: React.FocusEvent) {
        if (!ev.currentTarget.contains(ev.relatedTarget)) {
            keyboardVisRef.current && keyboardVisRef.current.focus()
        }
    }

    function content() {
        switch (step) {
            case 'explain':
                return (
                    <>
                        <div className="absolute left-6 top-0 text-gray-500">
                            1/3
                        </div>
                        <p>
                            This setup is required once for shortcuts to work properly. {}
                            We need to collect your keyboard layout's mapping from physical {}
                            keys to their corresponding character.
                        </p>
                        <button
                            className="rounded px-2 py-1 border border-blue-500 text-blue-700 hover:bg-blue-100"
                            onClick={() => setStep('noshift')}
                        >
                            Start {'>'}
                        </button>
                    </>
                )

            case 'noshift':
                return (
                    <>
                        <div className="absolute left-6 top-0 text-gray-500">
                            2/3
                        </div>

                        <p>
                            Please press all your keyboard keys one after {}
                            another without any modifier keys. {}
                            <span className="text-gray-400 hover:text-gray-800">
                                (No Ctrl, Alt/Option, Meta/Cmd or Shift)
                            </span>
                        </p>

                        <KeyCollectorVisualization ref={keyboardVisRef} keyMap={keyMap} />

                        <div className="flex flex-col space-y-2 items-stretch">
                            <button
                                className="rounded px-2 py-1 border border-blue-500 text-blue-700 hover:bg-blue-100"
                                onClick={() => setStep('shift')}
                            >
                                Next {'>'}
                            </button>
                            <button
                                className="text-xs text-gray-500 hover:text-blue-500"
                                onClick={() => setStep('explain')}
                            >
                                {'<'} Back
                            </button>
                        </div>
                    </>
                )

            case 'shift':
                return (
                    <>
                        <div className="absolute left-6 top-0 text-gray-500">
                            3/3
                        </div>

                        <p>
                            Now press all your keyboard keys another time {}
                            <em>with Shift</em>.
                        </p>

                        <KeyCollectorVisualization ref={keyboardVisRef} keyMap={keyMap} />

                        {keyMap.count() < 40 &&
                            <p>
                                Only {keyMap.count()} keys collected. Are these all keys?
                            </p>
                        }
                        {shiftMissing.length > 0 &&
                            <p>
                                <FontAwesomeIcon className="text-red-500" icon={regularIcons.faCircleXmark} />{' '}
                                These keys need to be pressed with shift: {shiftMissing.map(key => <KeyButton keyName={key} />)}
                            </p>
                        }
                        {noshiftMissing.length > 0 &&
                            <p>
                                <FontAwesomeIcon className="text-red-500" icon={regularIcons.faCircleXmark} />{' '}
                                These keys need to be pressed without shift: {noshiftMissing.map(key => <KeyButton keyName={key} />)}
                            </p>
                        }
                        {matches &&
                            <p>
                                Looks good <FontAwesomeIcon className="text-green-500" icon={solidIcons.faCircleCheck} />
                            </p>
                        }

                        <div className="flex flex-col space-y-2 items-stretch">
                            <button
                                className={`rounded px-2 py-1 ${matches ? "border border-green-500 text-green-700" : "bg-red-100 text-red-800"}`}
                                onClick={onDone}
                            >
                                {matches ?
                                    "I have pressed all keys – finish setup"
                                :
                                    "finish setup despite missing keys"
                                }
                            </button>
                            <button
                                className="text-xs text-gray-500 hover:text-blue-500"
                                onClick={() => setStep('noshift')}
                            >
                                {'<'} Back
                            </button>
                        </div>

                    </>
                )
        }
    }

    function collectKey(event: React.KeyboardEvent) {
        switch (step) {
            case 'noshift':
            case 'shift':
                onCollectKey(event)
                break
        }

        event.stopPropagation()
        event.preventDefault()
    }

    return (
        <div
            className="absolute z-40 inset-0 flex justify-center items-center bg-gray-300/50 backdrop-blur-sm"
            onClick={onClickDismiss}
            onKeyDown={collectKey}
            onBlur={keepFocusOnBlur}
        >
            <div
                className="max-w-screen-sm w-full h-full flex justify-center items-center"
                style={{ containerType: 'size' }}
            >
                <div
                    className="relative rounded-xl border border-gray-200 px-10 py-8 w-full flex flex-col space-y-5 bg-white"
                >
                    <button className="absolute top-3 right-4 text-gray-500 hover:text-blue-500" onClick={onCancel}>
                        <FontAwesomeIcon icon={solidIcons.faXmark} />
                    </button>

                    {content()}
                </div>
            </div>
        </div>
    )
}

const KEYBOARD: [code: string, width?: number, ignore?: boolean][][] = [
    [["Backquote"],["Digit1"],["Digit2"],["Digit3"],["Digit4"],["Digit5"],["Digit6"],["Digit7"],["Digit8"],["Digit9"],["Digit0"],["Minus"],["Equal"],["Backspace", 1.5, true]],
    [["Tab", 1.5, true],["KeyQ"],["KeyW"],["KeyE"],["KeyR"],["KeyT"],["KeyY"],["KeyU"],["KeyI"],["KeyO"],["KeyP"],["BracketLeft"],["BracketRight"],["Backslash"]],
    [["CapsLock", 1.8, true],["KeyA"],["KeyS"],["KeyD"],["KeyF"],["KeyG"],["KeyH"],["KeyJ"],["KeyK"],["KeyL"],["Semicolon"],["Quote"],["Enter", 1.8, true]],
    [["ShiftLeft", 2.2, true],["KeyZ"],["KeyX"],["KeyC"],["KeyV"],["KeyB"],["KeyN"],["KeyM"],["Comma"],["Period"],["Slash"],["ShiftRight", 2.4, true]],
    [["fn", 1, true], ["ControlLeft", 1, true],["AltLeft", 1, true],["MetaLeft", 1.2, true],["Space", 5.3, true],["MetaRight", 1.2, true],["AltRight", 1, true],["ArrowLeft", 1.05, true],["ArrowUp", 1, true],["ArrowRight", 1.05, true]],
]

const KEYBOARD_CODES = Set(KEYBOARD.flatMap(row => row.map(([code]) => code)))


interface KeyCollectorVisualizationProps {
    keyMap: KeyMap
}

const KeyCollectorVisualization = React.forwardRef<HTMLDivElement, KeyCollectorVisualizationProps>(function KeyCollectorVisualization(
    { keyMap },
    ref,
) {
    const [keysDown, setKeysDown] = React.useState(Set())
    const isShift = keysDown.includes('ShiftLeft') || keysDown.includes('ShiftRight')

    function Key({ code, width = 1, ignore = false }: { code: string, width?: number, ignore?: boolean }) {
        const base = 6
        const { noshift, shift } = keyMap.get(code, { noshift: undefined, shift: undefined })
        const countKnown = (noshift ? 1 : 0) + (shift ? 1 : 0)
        const [primary, secondary] = isShift ? [shift, noshift] : [noshift, shift]
        const color = ['red-200', 'yellow-200', 'green-200'][countKnown]
        return (
            <div
                style={{ height: base + 'cqw', width: base * width + 'cqw' }}
                className={`
                    text-center rounded border
                    flex justify-center items-center relative
                    ${!ignore && `border-${color} shadow-${color}`}
                    ${!ignore && keysDown.includes(code) ? `translate-y-0.5` : 'shadow'}
                    ${ignore && (keysDown.includes(code) ? 'bg-gray-200' : 'bg-gray-100')}
                `}
            >
                {!ignore && <>
                    <span>{primary ?? ""}</span>
                    <div className="hidden sm:block absolute right-0.5 top-0.5 text-gray-300 text-xs">{secondary ?? ""}</div>
                </>}
            </div>
        )
    }

    return (
        <div
            ref={ref}
            tabIndex={-1}
            onKeyDown={event => { setKeysDown(set => set.add(event.code)) }}
            onKeyUp={event => { setKeysDown(set => set.remove(event.code)) }}
            className="w-full flex flex-col space-y-1 cursor-pointer opacity-50 focus:opacity-100 focus:outline-none"
        >
            {KEYBOARD.map(row =>
                <div className="flex flex-row space-x-1">
                    {row.map(([code, width=1, ignore=false]) => (
                        <Key code={code} width={width} ignore={ignore}/>
                    ))}
                </div>
            )}
        </div>
    )
})