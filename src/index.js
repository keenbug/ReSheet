import React from 'react'
import ReactDOM from 'react-dom'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import 'prismjs/themes/prism.css'

import { getNextId, REPL, StateViewer, precompute, emptyCode, updateCode, stripCachedResult, rebuildCode, concatCode, reindexCode } from './repl'
import { ValueViewer, ErrorBoundary } from './value'
import stdLibrary from './std-library'
import { IconToggleButton, classed } from './ui'
import { catchAll, subUpdate } from './utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'




/****************** Main Application ******************/

const AppContent = ({ code, setCode, mode, setMode }) => {
    switch (mode) {
        case 'code':
            return (
                <ErrorBoundary title="There was an Error in the REPL">
                    <div className="flex flex-col space-y-4" style={{ marginBottom: '100vh' }}>
                        <REPL
                            code={code}
                            onUpdate={setCode}
                            globalEnv={stdLibrary}
                            env={stdLibrary}
                            nextId={getNextId(code)}
                        />
                    </div>
                </ErrorBoundary>
            )

        case 'state':
            return (
                <StateViewer state={code} onUpdate={subUpdate('state', setCode)} env={stdLibrary} />
            )
        
        case 'app':
            return (
                <ValueViewer
                    value={code.cachedResult}
                    state={code.state}
                    setState={subUpdate('state', setCode)}
                />
            )

        default:
            return (
                <div>
                    <p>Invalid mode in AppContent: {mode}</p>
                    <button onClick={() => setMode('code')}>Switch to Code</button>
                </div>
            )
    }
}

const MenuLine = classed('div')`flex flex-row shadow mb-1 w-full`

const Spacer = classed('div')`flex-1`

const DownloadButtonHTML = classed('a')`
    block
    text-left
    text-slate-600

    hover:bg-gray-200 hover:text-slate-600
    focus:bg-gray-300 focus:text-slate-700

    transition-colors

    outline-none
    h-7 px-1 space-x-1
`

const UploadLabel = classed('label')`
    cursor-pointer
    text-left
    text-slate-600

    hover:bg-gray-200 hover:text-slate-600
    focus:bg-gray-300 focus:text-slate-700

    transition-colors

    outline-none
    h-7 px-1 space-x-1
`

const DownloadButton = ({ code }) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stripCachedResult(code)));

    return (
        <DownloadButtonHTML className="self-end" href={dataStr} download="Code.json">
            <div className="inline-block w-5 text-center">
                <FontAwesomeIcon size="xs" icon={solidIcons.faSave} />
            </div>
        </DownloadButtonHTML>
    )
}

const UploadButton = ({ setCode }) => {
    const uploadFile = event => {
        event.target.files[0].text()
            .then(content => {
                const newCode = rebuildCode(JSON.parse(content))
                setCode(code =>
                    precompute(
                        concatCode(
                            newCode,
                            reindexCode(code, getNextId(newCode)),
                        ),
                        stdLibrary,
                        true,
                    )
                )
            })
    }
    return (
        <UploadLabel>
            <div className="inline-block w-5 text-center">
                <FontAwesomeIcon size="xs" icon={solidIcons.faFolderOpen} />
            </div>
            <input className="hidden" type="file" onChange={uploadFile} />
        </UploadLabel>
    )
}

const DeleteButtonHTML = classed('button')`
    text-left
    text-slate-600

    hover:bg-gray-200 hover:text-slate-600
    focus:bg-gray-300 focus:text-slate-700

    transition-colors

    outline-none
    h-7 px-1 space-x-1
`

const DeleteButton = ({ setCode }) => {
    const onDelete = () => {
        if (window.confirm("Sure you want to delete everything?")) {
            setCode(precompute(emptyCode))
        }
    }
    return (
        <DeleteButtonHTML onClick={onDelete}>
            <div className="inline-block w-5 text-center">
                <FontAwesomeIcon size="xs" icon={solidIcons.faTrash} />
            </div>
        </DeleteButtonHTML>
    )
}

const App = () => {
    const loadSavedCode = () => precompute(rebuildCode(JSON.parse(localStorage.getItem('code')) ?? emptyCode), stdLibrary, true)
    const [code, setCode] = React.useState(loadSavedCode)
    const [mode, setMode] = React.useState('code')

    const setCodeAndCompute = updateCode(setCode, stdLibrary)

    React.useEffect(() => {
        localStorage.setItem('code', JSON.stringify(stripCachedResult(code)))
    }, [code])

    return (
        <React.Fragment>
            <MenuLine>
                <IconToggleButton isActive={mode === 'app'} icon={solidIcons.faPlay} onUpdate={() => setMode('app')} />
                <IconToggleButton isActive={mode === 'code'} icon={solidIcons.faCode} onUpdate={() => setMode('code')} />
                <IconToggleButton isActive={mode === 'state'} icon={solidIcons.faHdd} onUpdate={() => setMode('state')} />
                <Spacer />
                <DeleteButton setCode={setCode} />
                <UploadButton setCode={setCode} />
                <DownloadButton code={code} />
            </MenuLine>
            <AppContent
                code={code} setCode={setCodeAndCompute}
                mode={mode} setMode={setMode}
            />
        </React.Fragment>
    )
}

const container = document.getElementById("app")

ReactDOM.render(
    <App />,
    container,
)