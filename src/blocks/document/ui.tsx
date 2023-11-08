import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import { BlockDesc, Environment } from '../../logic/block'
import { LoadFileButton, saveFile } from '../../ui/utils'
import { useAutoretrigger } from '../../ui/hooks'
import { DocumentState } from './model'
import * as Model from './model'


export interface DocumentUiProps<State> {
    state: DocumentState<State>
    update: (action: (state: DocumentState<State>) => DocumentState<State>) => void
    env: Environment
    innerBlock: BlockDesc<State>
}

export function DocumentUi<State>({ state, update, env, innerBlock }: DocumentUiProps<State>) {
    function updateInner(action: (state: State) => State) {
        update((state: DocumentState<State>): DocumentState<State> => {
            const blockState = action(state.blockState)
            return {
                ...state,
                blockState,
                history: Model.reduceHistory([
                    ...state.history,
                    { type: 'state', time: new Date(), blockState },
                ]),
            }
        })
    }

    function onSave() {
        const content = JSON.stringify(Model.toJSON(state, innerBlock))
        saveFile(
            state.name + '.json',
            'application/json',
            content,
        )
    }

    async function onLoadFile(file: File) {
        const content = JSON.parse(await file.text())
        try {
            const newState = Model.fromJSON(content, env, innerBlock)
            update(() => newState)
        }
        catch (e) {
            window.alert(`Could not load file: ${e}`)
        }
    }

    const localEnv = { ...env, history: state.history }

    function viewToplevelBlock() {
        switch (state.viewState.mode) {
            case 'current':
                return innerBlock.view({
                    state: state.blockState,
                    update: updateInner,
                    env: localEnv,
                })
            
            case 'history':
                const entryInHistory = state.history[state.viewState.position]
                if (entryInHistory === undefined) { return null }

                const stateInHistory = Model.getHistoryState(entryInHistory, innerBlock, localEnv)
                return innerBlock.view({
                    state: stateInHistory,
                    update: () => {},
                    env: localEnv,
                })
        }
    }

    const onOpenHistory  = () => update(Model.openHistory)
    const onCloseHistory = () => update(Model.closeHistory)
    const onGoBack       = () => update(Model.goBackInHistory)
    const onGoForward    = () => update(Model.goForwardInHistory)
    const onUseState     = () => update(state => Model.viewStateFromHistory(state, innerBlock, localEnv))
    const onChangeName   = name => update(state => ({ ...state, name }))

    return (
        <React.Fragment>
            <MenuBar
                state={state}
                onOpenHistory={onOpenHistory}
                onCloseHistory={onCloseHistory}
                onGoBack={onGoBack}
                onGoForward={onGoForward}
                onUseState={onUseState}
                onChangeName={onChangeName}
                onSave={onSave}
                onLoadFile={onLoadFile}
                />
            {viewToplevelBlock()}
        </React.Fragment>
    )
}



export function MenuBar({ state, onOpenHistory, onCloseHistory, onGoBack, onGoForward, onUseState, onChangeName, onSave, onLoadFile }) {
    const [startGoBack, stopGoBack] = useAutoretrigger(onGoBack)
    const [startGoForward, stopGoForward] = useAutoretrigger(onGoForward)

    switch (state.viewState.mode) {
        case 'current':
            return (
                <div
                    className={`
                        sticky top-0 left-0 z-10
                        bg-white backdrop-opacity-90 backdrop-blur
                        shadow p-1 mb-2 flex space-x-2 items-baseline
                    `}
                    >
                    <button
                        className={`
                            px-2 py-0.5 rounded
                            hover:text-blue-900 hover:bg-blue-200
                        `}
                        onClick={onOpenHistory}
                        >
                        <FontAwesomeIcon className="mr-1" size="xs" icon={solidIcons.faClockRotateLeft} />
                        History
                    </button>
                    <div className="flex flex-1 space-x-2 justify-center items-baseline">
                        <input
                            className="w-14"
                            type="text"
                            value={state.name}
                            onChange={e => { onChangeName(e.target.value) }}
                            />
                        <button className="text-sm" onClick={onSave}>
                            save
                        </button>
                        <LoadFileButton className="text-sm" onLoad={onLoadFile}>
                            load
                        </LoadFileButton>
                    </div>
                </div>
            )
        case 'history':
        default:
            return (
                <div
                    className={`
                        sticky top-0 left-0 z-10
                        bg-white backdrop-opacity-90 backdrop-blur
                        shadow p-1 mb-2 flex space-x-2 items-baseline
                    `}
                    >
                    <button
                        className={`
                            px-2 py-0.5 rounded
                            text-blue-50 bg-blue-700 hover:bg-blue-500
                        `}
                        onClick={onCloseHistory}
                        >
                        <FontAwesomeIcon className="mr-1" size="xs" icon={solidIcons.faClockRotateLeft} />
                        History
                    </button>
                    <div className="self-center flex space-x-1 px-2">
                        <button onMouseDown={startGoBack} onMouseUp={stopGoBack} onMouseLeave={stopGoBack}>
                            <FontAwesomeIcon icon={solidIcons.faAngleLeft} />
                        </button>
                        <button onMouseDown={startGoForward} onMouseUp={stopGoForward} onMouseLeave={stopGoBack}>
                            <FontAwesomeIcon icon={solidIcons.faAngleRight} />
                        </button>
                        <div className="self-center px-1">
                            {formatTime(state.history[state.viewState.position].time)}
                        </div>
                    </div>
                    <button style={{ marginLeft: 'auto' }} onClick={onUseState}>
                        Use this state
                    </button>
                </div>
            )
    }
}


const secondInMs = 1000
const minuteInMs = 60 * secondInMs
const hourInMs = 60 * minuteInMs
const dayInMs = 24 * hourInMs

const formatTime = (date: Date) => {
    const diffInMs = Date.now() - date.getTime()
    if (diffInMs < dayInMs) {
        return Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)
    }
    else {
        const formatOptions: Intl.DateTimeFormatOptions = {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }
        return Intl.DateTimeFormat(undefined, formatOptions).format(date)
    }
}