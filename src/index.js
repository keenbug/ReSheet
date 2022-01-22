import React from 'react'
import ReactDOM from 'react-dom'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import 'prismjs/themes/prism.css'

import { getNextId, REPL, StateViewer, precompute, emptyCode, updateCode, stripCachedResult, rebuildCode, concatCode, reindexCode, parseJsCode, linkCodes, exportJsCode } from './repl'
import { ValueViewer, ErrorBoundary } from './value'
import stdLibrary, { LIBRARY_MAPPINGS } from './std-library'
import { IconToggleButton, classed, TextInput, SaveFileButton, LoadFileButton } from './ui'
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

const SaveFileButtonStyled = classed(SaveFileButton)`
    block
    text-left
    text-slate-600

    hover:bg-gray-200 hover:text-slate-600
    focus:bg-gray-300 focus:text-slate-700

    transition-colors

    outline-none
    h-7 px-1 space-x-1
`

const LoadFileButtonStyled = classed(LoadFileButton)`
    cursor-pointer
    text-left
    text-slate-600

    hover:bg-gray-200 hover:text-slate-600
    focus:bg-gray-300 focus:text-slate-700

    transition-colors

    outline-none
    h-7 px-1 space-x-1
`

const DownloadButton = ({ code, name }) => (
    <SaveFileButtonStyled
        className="self-end"
        mimeType="text/json"
        textContent={JSON.stringify(stripCachedResult(code))}
        filename={name + '.json'}
    >
        <div className="inline-block w-5 text-center">
            <FontAwesomeIcon size="xs" icon={solidIcons.faSave} />
        </div>
    </SaveFileButtonStyled>
)

const ImportButton = ({ setCode }) => {
    const importJavascriptFile = async file => {
        const content = await file.text()
        setCode(code => {
            const importedCode = reindexCode(
                linkCodes(
                    parseJsCode(content, LIBRARY_MAPPINGS).reverse()
                ),
                getNextId(code)
            )
            return precompute(
                concatCode(
                    importedCode,
                    code,
                ),
                stdLibrary,
                true,
            )
        })
    }
    return (
        <LoadFileButtonStyled onLoad={importJavascriptFile}>
            <div className="inline-block w-5 text-center">
                <FontAwesomeIcon size="xs" icon={solidIcons.faFileImport} />
            </div>
        </LoadFileButtonStyled>
    )
}

const ExportButton = ({ name, code }) => (
    <SaveFileButtonStyled
        mimeType="text/javascript"
        textContent={exportJsCode(code)}
        filename={name + '.js'}
    >
        <div className="inline-block w-5 text-center">
            <FontAwesomeIcon size="xs" icon={solidIcons.faFileExport} />
        </div>
    </SaveFileButtonStyled>
)

const UploadButton = ({ setCode }) => {
    const loadFile = async file => {
        const content = await file.text()
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
    }
    return (
        <LoadFileButtonStyled onLoad={loadFile}>
            <div className="inline-block w-5 text-center">
                <FontAwesomeIcon size="xs" icon={solidIcons.faFolderOpen} />
            </div>
        </LoadFileButtonStyled>
    )
}

const DeleteButtonHTML = classed('button')`
    block
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

const NameInput = classed(TextInput)`
    self-center
    text-sm
    text-slate-600
    hover:bg-gray-200 hover:text-slate-700
    focus:bg-gray-200 focus:text-slate-700
    p-0.5 -ml-0.5
    rounded
`

const App = () => {
    const loadSavedCode = () => precompute(rebuildCode(JSON.parse(localStorage.getItem('code')) ?? emptyCode), stdLibrary, true)
    const [code, setCode] = React.useState(loadSavedCode)
    const [mode, setMode] = React.useState('code')
    const [name, setName] = React.useState('Code')

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
                <NameInput value={name} onUpdate={setName} />
                <DeleteButton setCode={setCode} />
                <ImportButton setCode={setCode} />
                <ExportButton code={code} name={name} />
                <UploadButton setCode={setCode} />
                <DownloadButton code={code} name={name} />
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