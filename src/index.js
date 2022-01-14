import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import * as Babel from '@babel/core'
import BabelReact from '@babel/preset-react'
import { useCodeJar } from 'react-codejar'
import Prism from 'prismjs'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'
import { TextInput, subUpdate, classed, nextElem, onMetaEnter } from './utils'
import Inspector, { ObjectRootLabel, ObjectLabel } from 'react-inspector'

import 'prismjs/themes/prism.css'

/**************** Dynamic Code Execution **************/

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
    name: code.name.length > 0 ? code.name : findNextFreeTempVarName(code.env),
    expr: code.expr,
    mode: code.mode,
    env: code.env,
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

    render() {
        if (this.state.caughtError) {
            return (
                <React.Fragment>
                    <h3>An error occurred in your component</h3>
                    <h4>{this.state.caughtError.name}</h4>
                    <pre className="break-normal">{this.state.caughtError.message}</pre>
                </React.Fragment>
            )
        }

        return this.props.children
    }
}


/**************** REPL *****************/

const REPL_MODES = ['both', 'result', 'code']
const REPL_ICON = {
    both: (
        <React.Fragment>
            <FontAwesomeIcon size="xs" icon={solidIcons.faCode} />
            <br />
            <FontAwesomeIcon size="xs" icon={solidIcons.faPlay} />
        </React.Fragment>
    ),
    result: <FontAwesomeIcon size="xs" icon={solidIcons.faPlay} />,
    code: <FontAwesomeIcon size="xs" icon={solidIcons.faCode} />,
}

const REPLModeButton = classed('button')`
    text-slate-500
    hover:text-slate-600
    active:text-slate-700

    hover:bg-gray-200
    active:bg-gray-300

    transition-colors

    w-7
    leading-6

    rounded
`

const REPLMode = ({ mode, onUpdate }) =>
    <REPLModeButton
        onClick={() => onUpdate(mode => nextElem(mode, REPL_MODES))}
    >
        {REPL_ICON[mode]}
    </REPLModeButton>



const REPLLine = classed('div')`flex flex-row space-x-2`
const REPLContent = classed('div')`flex flex-col space-y-1`



const REPL = ({ code, onUpdate }) => {
    const onUpdateExpr = expr => {
        onUpdate(code => ({ ...code, expr }))
    }

    const onNewExpr = () => {
        onUpdate(code => ({
            ...code,
            expr: "",
            mode: 'both',
            env: addNewDef(code),
        }))
    }

    return (
        <React.Fragment>
            {code.env &&
                <REPL
                    code={code.env}
                    onUpdate={subUpdate('env', onUpdate)}
                />
            }
            <REPLLine>
                <REPLMode mode={code.mode} onUpdate={subUpdate('mode', onUpdate)} />
                <REPLContent>
                    { code.name.length > 0 &&
                        <div className="self-start text-slate-500 font-light text-xs -mb-1">
                            <TextInput
                                className="hover:bg-gray-200 hover:text-slate-700 focus:bg-gray-200 focus:text-slate-700 outline-none p-0.5 rounded"
                                value={code.name}
                                onUpdate={subUpdate('name', onUpdate)}
                            />
                            &nbsp;=
                        </div>
                    }
                    {code.mode !== 'result' &&
                        <CodeEditor
                            code={code.expr}
                            onUpdate={onUpdateExpr}
                            onKeyPress={onMetaEnter(onNewExpr)}
                        />
                    }
                    {code.mode !== 'code' &&
                        <ValueInspector value={runExpr(code.expr, localEnv(code.env, { React }))} />
                    }
                </REPLContent>
            </REPLLine>
        </React.Fragment>
    )
}




/****************** Main Application ******************/

const StateEditor = ({ state, onUpdate }) => {
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
            <CodeEditor code={stateJSON} onUpdate={setStateJSON} onRun={() => {}} />
            <p>{validJSON ? "saved" : "invalid JSON"}</p>
        </div>
    )
}

const APP_MODES = [ 'app', 'state' ]

const App = () => {
    const [state, onUpdate] = React.useState(JSON.parse(localStorage.getItem('state') ?? "{}"))
    const [mode, setMode] = React.useState(APP_MODES[0])

    React.useEffect(() => {
        localStorage.setItem('state', JSON.stringify(state))
    }, [state])

    return (
        <React.Fragment>
            <button onClick={() => setMode(nextElem(mode, APP_MODES))}>{mode}</button>
            {mode === 'app' ?
                <ErrorBoundary>
                    <div className="flex flex-col space-y-4">
                        <REPL
                            code={state.code}
                            onUpdate={subUpdate('code', onUpdate)}
                        />
                    </div>
                </ErrorBoundary>
            :
                <StateEditor state={state} onUpdate={onUpdate} />
            }
        </React.Fragment>
    )
}

const container = document.getElementById("app")

ReactDOM.render(
    <App />,
    container,
)