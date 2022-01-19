import React from 'react'
import ReactDOM from 'react-dom'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import 'prismjs/themes/prism.css'

import { getNextId, REPL, StateViewer, precompute, emptyCode, updateCode } from './repl'
import { ValueViewer, ErrorBoundary } from './value'
import stdLibrary from './std-library'
import { IconToggleButton, classed } from './ui'
import { catchAll, subUpdate } from './utils'




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
                <StateViewer state={code.state} onUpdate={subUpdate('state', setCode)} env={stdLibrary} />
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

const MenuLine = classed('div')`shadow mb-1`

const App = () => {
    const loadSavedCode = () => precompute(JSON.parse(localStorage.getItem('code')) ?? emptyCode, stdLibrary, true)
    const [code, setCode] = React.useState(loadSavedCode)
    const [mode, setMode] = React.useState('code')

    const setCodeAndCompute = updateCode(setCode, stdLibrary)

    React.useEffect(() => {
        localStorage.setItem('code', JSON.stringify(code))
    }, [code])

    return (
        <React.Fragment>
            <MenuLine>
                <IconToggleButton isActive={mode === 'app'} icon={solidIcons.faPlay} onUpdate={() => setMode('app')} />
                <IconToggleButton isActive={mode === 'code'} icon={solidIcons.faCode} onUpdate={() => setMode('code')} />
                <IconToggleButton isActive={mode === 'state'} icon={solidIcons.faHdd} onUpdate={() => setMode('state')} />
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