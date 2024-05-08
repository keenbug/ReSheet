import * as React from 'react'
import ReactDOM from 'react-dom/client'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { BlockActionContext, BlockActionOutput, BlockHandle, useBlockDispatcher } from '@resheet/core/block'

import { DocumentOf, DocumentState } from '@resheet/blocks/document'
import { BlockSelector, BlockSelectorState } from '@resheet/blocks/block-selector'
import { safeBlock } from '@resheet/blocks/component'

import { PendingState, useThrottlePending } from '@resheet/util/hooks'
import { getFullKey } from '@resheet/util/shortcuts'

import { library } from './std-library'
import { db, removeOldBackups } from './backup'
import { FocusIndicator } from './focus-indicator'
import { useActionToast } from './action-toast'

import ReSheetIntroduction from './resources/introduction.js'
import docs from '@resheet/docs'
import gatherDocs from './docs'
import { Note, SheetOf } from '@resheet/blocks'

import './hoist-react'

const logoTypeSrc = new URL("../../assets/images/logotype.svg", import.meta.url)

const blocks = library.blocks

type ToplevelBlockState = DocumentState<BlockSelectorState>
const ToplevelBlock = safeBlock(DocumentOf(BlockSelector('SheetOf(Note)', SheetOf(Note), blocks)))

const ToplevelInput: [BlockActionContext] = [{ env: library }]


interface AppProps {
    backupId: string
    initJson: any | undefined
}

function App({ backupId, initJson=ReSheetIntroduction }: AppProps) {
    const handleDispatchOutput = React.useCallback(function handleDispatchOutput(output: BlockActionOutput, oldState: ToplevelBlockState) {
        if (output.description) {
            addActionToast(output.description, oldState)
        }
    }, [])
    const undoState = React.useCallback(function undoState(beforeState: ToplevelBlockState, description: string) {
        dispatch(() => ({
            state: beforeState,
            description: `undo: ${description}`,
        }))
    }, [])
    const [actionToastUi, addActionToast] = useActionToast<ToplevelBlockState>(undoState)

    const [toplevelState, dispatch] = useBlockDispatcher<ToplevelBlockState>(ToplevelBlock.init, ToplevelInput, handleDispatchOutput)
    const toplevelBlockRef = React.useRef<BlockHandle>()

    const [backupPendingState, throttledBackup] = useThrottlePending(3000, execBackup)

    // Load initial state
    React.useEffect(() => {
        if (initJson !== undefined) {
            dispatch(() => ({
                state: ToplevelBlock.fromJSON(initJson, dispatch, library)
            }))
        }
    }, [initJson])


    // Save backup of the current state
    React.useEffect(() => {
        // On first render: don't overwrite a backup before it was loaded
        if (toplevelState !== ToplevelBlock.init) {
            throttledBackup(backupId, () => ToplevelBlock.toJSON(toplevelState))
        }
    }, [backupId, toplevelState])


    // Change window.location, so the backup will be automatically loaded on a refresh
    React.useEffect(() => {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('backup', backupId);
        window.history.replaceState({}, document.title, currentUrl.toString());
    }, [backupId])


    // Handlers to keep focus on the app
    React.useEffect(() => {
        function fixFocus() {
            if (!rootElement.contains(document.activeElement)) {
                toplevelBlockRef.current?.focus()
            }
        }

        // keep the focus on the toplevel block, so its KeyEventHandlers keep working
        function onFocusout(event: FocusEvent) {
            // this could be problematic, but let's wait until problems arise
            if (event.relatedTarget === null || event.relatedTarget instanceof Element && !rootElement.contains(event.relatedTarget)) {
                toplevelBlockRef.current?.focus()
            }
        }

        function onKeyDown(event: KeyboardEvent) {
            switch (getFullKey(event)) {
                case 'Enter':
                    if (document.activeElement === document.body) {
                        toplevelBlockRef.current?.focus()
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case 'Escape':
                    // don't exit full-screen in Safari
                    //   I hope nobody really wants this. Personally, this annoys me all the time.
                    //   So I prevent it until somebody complains.
                    event.preventDefault()
                    return
            }
        }

        toplevelBlockRef.current?.focus()
        document.addEventListener('keydown', onKeyDown)
        rootElement.addEventListener('focusout', onFocusout)
        const timeout = setInterval(fixFocus, 100)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            rootElement.removeEventListener('focusout', onFocusout)
            clearInterval(timeout)
        }
    }, [])


    return (
        <>
            <ToplevelBlock.Component
                ref={toplevelBlockRef}
                state={toplevelState}
                dispatch={dispatch}
                env={library}
                />
            <BackupIndicator className="absolute left-1 bottom-1 z-50 print:hidden" pendingState={backupPendingState} />
            <FocusIndicator />
            {actionToastUi}
        </>
    )
}


function BackupIndicator({ pendingState, className }: { pendingState: PendingState, className: string }) {
    return (
        <div
            className={`
                group border-2 border-transparent rounded-full
                pl-2 pr-3 py-0.5 space-x-2 text-sm
                hover:bg-white hover:border-gray-200
                ${className}
            `}
        >
            {pendingState.state === 'pending' ?
                <FontAwesomeIcon className="text-black/25 group-hover:text-gray-500" fade icon={solidIcons.faEllipsis} />
            : pendingState.state === 'finished' ?
                <FontAwesomeIcon
                    className="text-lime-500"
                    bounce
                    style={{
                        '--fa-animation-duration': '0.3s',
                        '--fa-animation-iteration-count': 1,
                        '--fa-bounce-start-scale-x': 1,
                        '--fa-bounce-start-scale-y': 1,
                        '--fa-bounce-jump-scale-x': 1,
                        '--fa-bounce-jump-scale-y': 1,
                        '--fa-bounce-land-scale-x': 1,
                        '--fa-bounce-land-scale-y': 1,
                        '--fa-bounce-rebound': 0,
                        '--fa-bounce-height': '-0.1rem',
                        '--fa-animation-timing': 'ease-out, ease-in',
                    }}
                    icon={solidIcons.faCheck}
                    />
            :
                <FontAwesomeIcon
                    className="text-red-500"
                    shake
                    style={{
                        '--fa-animation-dealy': '0.5s',
                        '--fa-animation-iteration-count': 1,
                    }}
                    icon={solidIcons.faTriangleExclamation}
                    />
            }
            <span className="text-gray-700 hidden group-hover:inline">
                {pendingState.state === 'pending' ?
                    "Storing backup in IndexedDB"
                : pendingState.state === 'finished' ?
                    "Backup stored in IndexedDB"
                :
                    `Failed storing backup in IndexedDB: ${pendingState.error}`
                }
            </span>
        </div>
    )
}


function LoadingScreen() {
    return (
        <div className="w-screen h-screen flex flex-col justify-center items-center space-y-2">
            <img className="h-24 w-auto" src={logoTypeSrc.toString()} />
            <div>
                <FontAwesomeIcon icon={solidIcons.faSpinner} spinPulse size="sm" />
                {} loading...
            </div>
        </div>
    )
}


const backupWorker = new Worker(
    new URL('backup-worker.ts', import.meta.url),
    { type: 'module' },
)

function execBackup(id: string, thunk: () => any) {
    return new Promise<void>(resolve => {
        const ref = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)

        backupWorker.addEventListener('message', waitForCompletion)
        backupWorker.postMessage({ id, ref, document: thunk() })

        function waitForCompletion(event: MessageEvent<{ done: number }>) {
            if (event.data.done === ref) {
                backupWorker.removeEventListener('message', waitForCompletion)
                resolve()
            }
        }
    })
}

async function loadBackup(id: string) {
    try {
        const backup = await db.backups
            .where('id').equals(id)
            .first()
        return backup.json
    }
    catch (e) {
        window.alert(`Could not load backup ${id}: ${e}`)
        return undefined
    }
}

async function loadRemoteFile(url: string) {
    try {
        const response = await fetch(url)
        const json = await response.json()
        return json
    }
    catch (e) {
        window.alert(`Could not load file from URL: ${e}`)
        return undefined
    }
}

function fallbackUUID() {
    return String(Math.trunc(Number.MAX_SAFE_INTEGER * Math.random()))
}

const genUUID = crypto.randomUUID ? () => crypto.randomUUID() : fallbackUUID

async function loadInit() {
    const params = new URLSearchParams(document.location.search)
    const loadParam = params.get('load')
    const backupParam = params.get('backup')

    if (backupParam !== null) {
        return [backupParam, await loadBackup(backupParam)]
    }

    if (loadParam !== null) {
        return [genUUID(), await loadRemoteFile(loadParam)]
    }

    return [genUUID(), undefined]
}


const rootElement = document.getElementById('app')
const root = ReactDOM.createRoot(rootElement)

async function startApp() {
    removeOldBackups()
    const loadingScreenTimeout = setTimeout(() => {
        root.render(<LoadingScreen />)
    }, 100)

    const [backupId, initJson] = await loadInit()
    clearTimeout(loadingScreenTimeout)
    root.render(<App backupId={backupId} initJson={initJson} />)
}

startApp()
gatherDocs(docs)