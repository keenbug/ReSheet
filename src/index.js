import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import 'prismjs/themes/prism.css'

import { REPL } from './repl'
import { ValueInspector, ErrorBoundary } from './value'
import stdLibrary from './std-library'
import { IconToggleButton, classed, onMetaEnter } from './ui'
import { subUpdate } from './utils'



/****************** State Viewer ******************/

const StateViewer = ({ state, onUpdate, env }) => {
    const [isEditing, setIsEditing] = React.useState(false)

    if (isEditing) {
        return (
            <StateEditor
                state={state}
                onUpdate={onUpdate}
                onClose={() => setIsEditing(false)}
                env={env}
            />
        )
    }
    else {
        return (
            <div>
                <button onClick={() => { setIsEditing(true) }}>
                    <FontAwesomeIcon size="xs" icon={solidIcons.faPen} />
                </button>
                <ValueInspector value={state} />
            </div>
        )
    }
}

const StateEditor = ({ state, onUpdate, onClose, env }) => {
    const [stateJSON, setStateJSON] = React.useState(JSON.stringify(state, null, 2))
    const [validJSON, setValidJSON] = React.useState(true)
    const [mode, setMode] = React.useState('json')
    const [code, setCode] = React.useState({ ...emptyCode, expr: "state" })

    useEffect(() => {
        try {
            onUpdate(JSON.parse(stateJSON))
            setValidJSON(true)
        }
        catch (e) {
            setValidJSON(false)
        }
    }, [stateJSON])

    const onSaveComputed = () => {
        onUpdate(runExpr(code.expr, localEnv(code.env, { ...env, state })))
        onClose()
    }

    return (
        <div>
            <div className="w-max mb-0.5 border-b-2 border-gray-300">
                <ToggleButton
                    className={"w-auto px-1 text-xs font-bold " + (mode === 'json' ? "text-slate-500" : "text-slate-300")}
                    onClick={() => setMode('json')}
                >
                    JSON
                </ToggleButton>
                <IconToggleButton
                    isActive={mode === 'code'}
                    icon={solidIcons.faCode}
                    onUpdate={() => setMode('code')}
                />
            </div>
            <div>
                {mode === 'json' &&
                    <React.Fragment>
                        <CodeEditor
                            code={stateJSON} onUpdate={setStateJSON}
                            onKeyPress={onMetaEnter(onClose)}
                        />
                        <p>{validJSON ? "saved" : "invalid JSON"}</p>
                    </React.Fragment>
                }
                {mode === 'code' &&
                    <React.Fragment>
                        <REPL code={code} onUpdate={setCode} env={{ ...env, state }} />
                        <button onClick={onSaveComputed}>Save</button>
                    </React.Fragment>
                }
            </div>
        </div>
    )
}


/****************** Main Application ******************/

const AppContent = ({ code, onUpdate, mode, setMode }) => {
    switch (mode) {
        case 'code':
            return (
                <ErrorBoundary>
                    <div className="flex flex-col space-y-4 mb-8">
                        <REPL code={code} onUpdate={onUpdate} env={stdLibrary} />
                    </div>
                </ErrorBoundary>
            )

        case 'state':
            return (
                <StateViewer state={code.state} onUpdate={subUpdate('state', onUpdate)} env={stdLibrary} />
            )
        
        case 'app':
            return (
                <ValueViewer
                    value={runExpr(code.expr, localEnv(code.env, stdLibrary))}
                    state={code.state}
                    onUpdate={subUpdate('state', onUpdate)}
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

const MenuLine = classed('div')`shadow mb-1`

const App = () => {
    const [state, onUpdate] = React.useState(JSON.parse(localStorage.getItem('state') ?? "{}"))
    const [mode, setMode] = React.useState('code')

    React.useEffect(() => {
        localStorage.setItem('state', JSON.stringify(state))
    }, [state])

    return (
        <React.Fragment>
            <MenuLine>
                <IconToggleButton isActive={mode === 'app'} icon={solidIcons.faPlay} onUpdate={() => setMode('app')} />
                <IconToggleButton isActive={mode === 'code'} icon={solidIcons.faCode} onUpdate={() => setMode('code')} />
                <IconToggleButton isActive={mode === 'state'} icon={solidIcons.faHdd} onUpdate={() => setMode('state')} />
            </MenuLine>
            <AppContent
                code={state.code} onUpdate={subUpdate('code', onUpdate)}
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