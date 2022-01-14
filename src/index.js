import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import * as Babel from '@babel/core'
import BabelReact from '@babel/preset-react'
import { useCodeJar } from 'react-codejar'
import Prism from 'prismjs'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'
import { TextInput, subUpdate, classed, onMetaEnter } from './utils'
import Inspector from 'react-inspector'

import 'prismjs/themes/prism.css'

/**************** User Code Execution **************/

const runExpr = (code, env) => {
    if (!code) {
        return
    }
    try {
        // for error messages matching the user code, transform without the return first
        Babel.transform(code, { presets: [BabelReact] })

        const transformedCode = Babel.transform(
            `return (${code})`,
            {
                presets: [BabelReact],
                parserOpts: { allowReturnOutsideFunction: true },
            },
        ).code

        const exprFunc = new Function(
            ...Object.keys(env),
            transformedCode,
        )
        return exprFunc(...Object.values(env))
    }
    catch (e) {
        return e
    }
}

const localEnv = (def, globalEnv) => {
    if (!def) { return globalEnv }
    const env = localEnv(def.env, globalEnv)
    const defResult = runExpr(def.expr, env)
    return ({ ...env, [def.name]: defResult })
}

const isVarNameFree = (name, def) =>
    def ?
        def.name !== name && isVarNameFree(name, def.env)
    :
        true


const findNextFreeTempVarName = def => {
    for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
        if (isVarNameFree('$' + i, def)) {
            return '$' + i
        }
    }
    return '$$'
}

const addNewDef = code => ({
    ...code,
    name: code.name.length > 0 ? code.name : findNextFreeTempVarName(code.env),
    ui: { ...code.ui, isNameVisible: true },
})


const highlightJS = editor => {
    const text = editor.textContent
    editor.innerHTML = Prism.highlight(
        text,
        Prism.languages.javascript,
        'javascript'
    )
}


/**************** Code Editor *****************/

const CodeContent = classed('code')`
    block
    min-w-48 min-h-1
    rounded
    hover:bg-gray-100 focus:bg-gray-100
`


const CodeEditor = ({ code, onUpdate, ...props }) => {
    const ref = useCodeJar({
        code,
        onUpdate,
        highlight: highlightJS,
        options: {
            tab: "  ",
        },
    })

    return <pre><CodeContent ref={ref} {...props} /></pre>
}


/**************** Value Viewer *****************/

const ValueInspector = ({ value }) => {
    if (React.isValidElement(value)) {
        return <ErrorBoundary>{value}</ErrorBoundary>
    }
    return <div><Inspector data={value} /></div>
}

const stateful = Symbol('stateful')
const Stateful = callback => ({
    $$type: stateful,
    callback,
})
const isStateful = value => value?.$$type === stateful

const catchAll = (fn, onError = e => e) => {
    try {
        return fn()
    }
    catch (e) {
        return onError(e)
    }
}

const ValueViewer = ({ value, state, onUpdate }) => {
    if (isStateful(value)) {
        return <ValueInspector value={catchAll(() => value.callback({ state, onUpdate }))} />
    }
    return <ValueInspector value={value} />
}

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { caughtError: null }
    }

    static getDerivedStateFromError(error) {
        console.log("getDerivedStateFromError", error)
        return { caughtError: error }
    }

    componentDidCatch(error, errorInfo) {
        console.log("componentDidCatch", error, errorInfo)
    }

    retry() {
        this.setState({ caughtError: null })
    }

    render() {
        if (this.state.caughtError) {
            return (
                <div>
                    <h3>An error occurred in your component</h3>
                    <h4>{this.state.caughtError.name}</h4>
                    <pre className="break-normal">{this.state.caughtError.message}</pre>
                    <button onClick={this.retry.bind(this)}>Retry</button>
                </div>
            )
        }

        return this.props.children
    }
}


/**************** REPL *****************/

const ToggleButton = classed('button')`
    text-slate-500
    hover:text-slate-600
    active:text-slate-700

    hover:bg-gray-200
    active:bg-gray-300

    h-7 w-7
    rounded
    transition-colors
`

const IconToggleButton = ({ isActive, icon, iconDisabled, onUpdate }) => (
    <ToggleButton
        className={isActive ? "" : "text-slate-300"}
        onClick={onUpdate}
    >
        <FontAwesomeIcon size="xs" icon={isActive ? icon : (iconDisabled || icon)} />
    </ToggleButton>
)

const toggleProperty = propName => obj => (
    { ...obj, [propName]: !obj[propName] }
)

const REPLUIToggles = ({ ui, onUpdate }) => {
    const Toggle = ({ propName, icon, iconDisabled }) => (
        <IconToggleButton
            isActive={ui[propName]}
            icon={icon}
            iconDisabled={iconDisabled}
            onUpdate={() => onUpdate(toggleProperty(propName))}
        />
    )

    return (
        <div className="flex flex-col shadow-outline">
            <Toggle propName="isEnvVisible" icon={solidIcons.faFolderOpen} iconDisabled={solidIcons.faFolder} />
            <Toggle propName="isNameVisible" icon={solidIcons.faICursor} />
            <Toggle propName="isCodeVisible" icon={solidIcons.faCode} />
            <Toggle propName="isResultVisible" icon={solidIcons.faPlay} />
            <Toggle propName="isStateVisible" icon={solidIcons.faHdd} />
        </div>
    )
}



const REPLLine = classed('div')`flex flex-row space-x-2`
const REPLContent = classed('div')`flex flex-col space-y-1 flex-1`

const defaultCodeUI = {
    isEnvVisible: true,
    isNameVisible: false,
    isCodeVisible: true,
    isResultVisible: true,
    isStateVisible: true,
}

const REPL = ({ code, onUpdate }) => {
    const onUpdateExpr = expr => {
        onUpdate(code => ({ ...code, expr }))
    }

    const onNewExpr = () => {
        onUpdate(code => ({
            name: "",
            expr: "",
            ui: defaultCodeUI,
            state: null,
            env: addNewDef(code),
        }))
    }

    return (
        <React.Fragment>
            {code.ui.isEnvVisible && code.env &&
                <REPL
                    code={code.env}
                    onUpdate={subUpdate('env', onUpdate)}
                />
            }
            <REPLLine>
                <REPLUIToggles ui={code.ui} onUpdate={subUpdate('ui', onUpdate)} />
                <REPLContent>
                    { code.ui.isNameVisible &&
                        <div className="self-start text-slate-500 font-light text-xs -mb-1">
                            <TextInput
                                className="hover:bg-gray-200 hover:text-slate-700 focus:bg-gray-200 focus:text-slate-700 outline-none p-0.5 rounded"
                                value={code.name}
                                onUpdate={subUpdate('name', onUpdate)}
                                placeholder="name"
                            />
                            &nbsp;=
                        </div>
                    }
                    {code.ui.isCodeVisible &&
                        <CodeEditor
                            code={code.expr}
                            onUpdate={onUpdateExpr}
                            onKeyPress={onMetaEnter(onNewExpr)}
                        />
                    }
                    {code.ui.isResultVisible &&
                        <ValueViewer
                            value={runExpr(code.expr, localEnv(code.env, GLOBALS))}
                            state={code.state}
                            onUpdate={subUpdate('state', onUpdate)}
                        />
                    }
                    {code.ui.isStateVisible &&
                        <StateViewer state={code.state} onUpdate={subUpdate('state', onUpdate)} />
                    }
                </REPLContent>
            </REPLLine>
        </React.Fragment>
    )
}

const GLOBALS = { React, Stateful, REPL }




/****************** State Viewer ******************/

const StateViewer = ({ state, onUpdate }) => {
    const [isEditing, setIsEditing] = React.useState(false)
    const codeRef = React.useRef(null)

    React.useEffect(() => {
        if (!isEditing) {
            codeRef.current.innerHTML = Prism.highlight(
                JSON.stringify(state, null, 2),
                Prism.languages.javascript,
                'javascript',
            )
        }
    }, [isEditing, codeRef, state])

    if (isEditing) {
        return (
            <StateEditor
                state={state}
                onUpdate={onUpdate}
                onKeyPress={onMetaEnter(() => setIsEditing(false))}
            />
        )
    }
    else {
        return (
            <pre>
                <code ref={codeRef} onClick={() => setIsEditing(true)}></code>
            </pre>
        )
    }
}

const StateEditor = ({ state, onUpdate, ...props }) => {
    const [stateJSON, setStateJSON] = React.useState(JSON.stringify(state, null, 2))
    const [validJSON, setValidJSON] = React.useState(true)

    useEffect(() => {
        try {
            onUpdate(JSON.parse(stateJSON))
            setValidJSON(true)
        }
        catch (e) {
            setValidJSON(false)
        }
    }, [stateJSON])

    return (
        <div>
            <CodeEditor code={stateJSON} onUpdate={setStateJSON} {...props} />
            <p>{validJSON ? "saved" : "invalid JSON"}</p>
        </div>
    )
}


/****************** Main Application ******************/

const MenuLine = classed('div')`shadow mb-1 overflow-hidden transition-transform`

const AppContent = ({ code, onUpdate, mode, setMode }) => {
    switch (mode) {
        case 'code':
            return (
                <ErrorBoundary>
                    <div className="flex flex-col space-y-4">
                        <REPL code={code} onUpdate={onUpdate} />
                    </div>
                </ErrorBoundary>
            )

        case 'state':
            return (
                <StateEditor state={state} onUpdate={onUpdate} />
            )
        
        case 'app':
        case 'full-browser':
            return (
                <ValueViewer
                    value={runExpr(code.expr, localEnv(code.env, { ...GLOBALS, setMode }))}
                    state={code.state}
                    onUpdate={subUpdate('state', onUpdate)}
                />
            )

        default:
            return (
                <div>
                    <p>How did this happen? Invalid mode in AppContent: {mode}</p>
                    <button onClick={() => setMode('code')}>Switch to Code</button>
                </div>
            )
    }
}

const App = () => {
    const [state, onUpdate] = React.useState(JSON.parse(localStorage.getItem('state') ?? "{}"))
    const [mode, setMode] = React.useState('code')

    React.useEffect(() => {
        localStorage.setItem('state', JSON.stringify(state))
    }, [state])

    return (
        <React.Fragment>
            <MenuLine className={mode === 'full-browser' ? "-translate-y-full" : ""}>
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