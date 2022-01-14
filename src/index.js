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

import * as tables from './tables'

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

const defaultCodeUI = {
    isEnvVisible: true,
    isNameVisible: false,
    isCodeVisible: true,
    isResultVisible: true,
    isStateVisible: false,
}

const emptyCode = {
    name: "",
    expr: "",
    ui: defaultCodeUI,
    state: null,
    env: null,
}

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
    if (value instanceof Error) {
        return (
            <div>
                <h1>{value.name}</h1>
                <pre className="overflow-x-scroll">{value.message}</pre>
                <Inspector data={value} />
            </div>
        )
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
                    <pre className="overflow-x-scroll">{this.state.caughtError.message}</pre>
                    <button onClick={this.retry.bind(this)}>Retry</button>
                </div>
            )
        }

        return this.props.children
    }
}


/**************** REPL *****************/

const ToggleButton = classed('button')`
    text-left
    text-slate-600

    hover:bg-gray-200 hover:text-slate-600
    focus:bg-gray-300 focus:text-slate-700

    transition-colors

    outline-none
    h-7 px-1 space-x-1
`

const IconToggleButton = ({ className, isActive, icon, iconDisabled, onUpdate, label="" }) => (
    <ToggleButton
        className={(className ?? "") + (isActive ? "" : " text-slate-400")}
        onClick={onUpdate}
    >
        <div className="inline-block w-5 text-center">
            <FontAwesomeIcon size="xs" icon={isActive ? icon : (iconDisabled || icon)} />
        </div>
        {label && <span>{label}</span>}
    </ToggleButton>
)

const toggleProperty = propName => obj => (
    { ...obj, [propName]: !obj[propName] }
)

const MenuHTML = classed('ul')`
    flex flex-col
    bg-gray-100
    shadow
    rounded
    items-stretch
    w-max
    text-sm
    overflow-hidden
`

const REPLUIToggles = ({ ui, onUpdate, onDelete }) => {
    const [isMenuVisible, setMenuVisible] = React.useState(false)

    const Toggle = ({ propName, icon, iconDisabled, label }) => (
        console.log('label', label, `${ui[propName] ? "Hide" : "Show"} ${label}`),
        <li>
            <IconToggleButton
                className="w-full"
                isActive={ui[propName]}
                icon={icon}
                iconDisabled={iconDisabled}
                onUpdate={() => onUpdate(toggleProperty(propName))}
                label={`${ui[propName] ? "Hide" : "Show"} ${label}`}
            />
        </li>
    )

    const Menu = () => (
        <MenuHTML
            className="absolute -right-1 translate-x-full"
        >
            <Toggle
                propName="isNameVisible"
                icon={solidIcons.faICursor}
                label="Assignment"
            />
            <Toggle
                propName="isCodeVisible"
                icon={solidIcons.faCode}
                label="Code"
            />
            <Toggle
                propName="isResultVisible"
                icon={solidIcons.faPlay}
                label="Result"
            />
            <Toggle
                propName="isStateVisible"
                icon={solidIcons.faHdd}
                label="State"
            />
            <li>
                <IconToggleButton
                    className="w-full"
                    isActive={true}
                    icon={solidIcons.faTrash}
                    onUpdate={onDelete}
                    label="Delete"
                />
            </li>
        </MenuHTML>
    )

    return (
        <div
        >
            <div className="relative">
                {isMenuVisible && <Menu />}
            </div>
            <button
                className="px-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                onClick={() => setMenuVisible(visible => !visible)}
            >
                <FontAwesomeIcon size="xs" icon={solidIcons.faGripVertical} />
            </button>
        </div>
    )
}



const REPLLine = classed('div')`flex flex-row space-x-2`
const REPLContent = classed('div')`flex flex-col space-y-1 flex-1`

const VarNameInput = classed(TextInput)`
    hover:bg-gray-200 hover:text-slate-700
    focus:bg-gray-200 focus:text-slate-700
    outline-none
    p-0.5 -ml-0.5
    rounded
`

const REPL = ({ code, onUpdate, env }) => {
    const onUpdateExpr = expr => {
        onUpdate(code => ({ ...code, expr }))
    }

    const onNewExpr = () => {
        onUpdate(code => ({
            ...emptyCode,
            env: addNewDef(code),
        }))
    }

    const onDelete = () => {
        onUpdate(code => code.env)
    }

    return (
        <React.Fragment>
            {code.ui.isEnvVisible && code.env &&
                <REPL
                    code={code.env}
                    onUpdate={subUpdate('env', onUpdate)}
                    env={env}
                />
            }
            <REPLLine>
                <REPLUIToggles ui={code.ui} onUpdate={subUpdate('ui', onUpdate)} onDelete={onDelete} />
                <REPLContent>
                    {code.ui.isNameVisible &&
                        <div className="self-start text-slate-500 font-light text-xs -mb-1">
                            <VarNameInput
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
                            value={runExpr(code.expr, localEnv(code.env, env))}
                            state={code.state}
                            onUpdate={subUpdate('state', onUpdate)}
                        />
                    }
                    {code.ui.isStateVisible &&
                        <StateViewer state={code.state} onUpdate={subUpdate('state', onUpdate)} env={localEnv(code.env, env)} />
                    }
                </REPLContent>
            </REPLLine>
        </React.Fragment>
    )
}

const GLOBALS = { React, Stateful, REPL, tables, CodeEditor }




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
                <ToggleButton className={"w-auto px-1 text-xs font-bold " + (mode === 'json' ? "text-slate-500" : "text-slate-300")} onClick={() => setMode('json')}>JSON</ToggleButton>
                <IconToggleButton isActive={mode === 'code'} icon={solidIcons.faCode} onUpdate={() => setMode('code')} />
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
                        <REPL code={code} onUpdate={onUpdate} env={GLOBALS} />
                    </div>
                </ErrorBoundary>
            )

        case 'state':
            return (
                <StateViewer state={code.state} onUpdate={subUpdate('state', onUpdate)} env={GLOBALS} />
            )
        
        case 'app':
        case 'full-window':
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
            {mode !== 'full-window' &&
                <MenuLine>
                    <IconToggleButton isActive={mode === 'app'} icon={solidIcons.faPlay} onUpdate={() => setMode('app')} />
                    <IconToggleButton isActive={mode === 'code'} icon={solidIcons.faCode} onUpdate={() => setMode('code')} />
                    <IconToggleButton isActive={mode === 'state'} icon={solidIcons.faHdd} onUpdate={() => setMode('state')} />
                </MenuLine>
            }
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