import React from 'react'
import ReactDOM from 'react-dom'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import 'prismjs/themes/prism.css'

import { emptyCode, getNextId, REPL, useCachedCodeState } from './repl'
import { ValueViewer, StateViewer, ErrorBoundary } from './value'
import stdLibrary from './std-library'
import { IconToggleButton, classed } from './ui'
import { catchAll, subUpdate } from './utils'




/****************** Main Application ******************/

const AppContent = ({ code, cache, setCode, mode, setMode }) => {
    switch (mode) {
        case 'code':
            return (
                <ErrorBoundary title="There was an Error in the REPL">
                    <div className="flex flex-col space-y-4" style={{ marginBottom: '100vh' }}>
                        <REPL
                            code={code}
                            onUpdate={setCode}
                            cache={cache}
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
                    value={cache.result}
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
    const loadSavedCode = () => JSON.parse(localStorage.getItem('code')) ?? { ...emptyCode, id: Date.now() }
    const [{ code, cache }, setCode] = useCachedCodeState(loadSavedCode, stdLibrary)
    const [mode, setMode] = React.useState('code')

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
                code={code} cache={cache} setCode={setCode}
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