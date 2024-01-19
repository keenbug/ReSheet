import * as React from 'react'
import ReactDOM from 'react-dom/client'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import 'prismjs/themes/prism.css'

import { library } from './utils/std-library'
import { DocumentOf, DocumentState } from './blocks/document'
import { BlockSelector, BlockSelectorState } from './blocks/block-selector'
import { Block } from './block/component'
import { getFullKey } from './ui/shortcuts'
import { BlockRef } from './block'
import { storeBackup, db, removeOldBackups } from './backup'
import { PendingState, useThrottlePending } from './ui/hooks'


const blocks = library.blocks

type ToplevelBlockState = DocumentState<BlockSelectorState>
const ToplevelBlock = DocumentOf(BlockSelector('', null, blocks))


interface AppProps {
    backupId: string
    initJson: any | undefined
}

function App({ backupId, initJson }: AppProps) {
    const [toplevelState, setToplevelState] = React.useState<ToplevelBlockState>(ToplevelBlock.init)
    const toplevelBlockRef = React.useRef<BlockRef>()

    const [backupPendingState, throttledBackup] = useThrottlePending(3000, storeBackup)
    
    // Load initial state
    React.useEffect(() => {
        if (initJson !== undefined) {
            setToplevelState(ToplevelBlock.fromJSON(initJson, setToplevelState, library))
        }
    }, [initJson])


    // Save backup of the current state
    React.useEffect(() => {
        throttledBackup(backupId, ToplevelBlock.toJSON(toplevelState))
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
            <Block
                state={toplevelState}
                update={setToplevelState}
                block={ToplevelBlock}
                env={library}
                blockRef={toplevelBlockRef}
                />
            <BackupIndicator className="absolute left-1 bottom-1" pendingState={backupPendingState} />
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
            <FontAwesomeIcon icon={solidIcons.faSpinner} spinPulse size="2xl" />
            <div>Tables is loading...</div>
        </div>
    )
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

async function loadInit() {
    const params = new URLSearchParams(document.location.search)
    const loadParam = params.get('load')
    const backupParam = params.get('backup')

    if (backupParam !== null) {
        return [backupParam, await loadBackup(backupParam)]
    }

    if (loadParam !== null) {
        return [crypto.randomUUID(), await loadRemoteFile(loadParam)]
    }

    return [crypto.randomUUID(), undefined]
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