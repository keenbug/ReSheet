import React from 'react'
import ReactDOM from 'react-dom'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import 'prismjs/themes/prism.css'

import { REPL } from './repl'
import { ValueViewer, StateViewer, ErrorBoundary } from './value'
import stdLibrary from './std-library'
import { IconToggleButton, classed } from './ui'
import { subUpdate } from './utils'




/****************** Main Application ******************/

const AppContent = ({ code, onUpdate, mode, setMode }) => {
    switch (mode) {
        case 'code':
            return (
                <ErrorBoundary>
                    <div className="flex flex-col space-y-4" style={{ marginBottom: '100vh' }}>
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