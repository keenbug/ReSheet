import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import * as Babel from '@babel/core'
import BabelReact from '@babel/preset-react'
import { useCodeJar } from 'react-codejar'
import Prism from 'prismjs'
import 'prismjs/themes/prism.css'
import styled from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'


/**************** Dynamic Code Execution **************/

const highlightJS = editor => {
    const text = editor.textContent
    editor.innerHTML = Prism.highlight(
        text,
        Prism.languages.javascript,
        'javascript'
    )
}

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

const mergeRefs = (...refs) => inst => 
    refs.forEach(ref => {
        if (typeof ref === 'function') {
            ref(inst);
        } else if (ref) {
            ref.current = inst;
        }
    })


const CodeContent = styled.code`
    min-width: 20em;
    min-height: 1em;
    display: block;
    border: 1px solid transparent;
    border-radius: 3px;

    :hover {
        background-color: #fafafa;
        border: 1px solid #eee;
    }
`


const CodeEditor = ({ code, onUpdate, onRun }) => {
    const ref = useCodeJar({
        code,
        onUpdate,
        highlight: highlightJS,
        options: {
            tab: "  ",
        },
    })

    const onKeyPress = event => {
        if (event.key === 'Enter' && event.metaKey) {
            event.preventDefault()
            onRun()
        }
    }

    return <pre><CodeContent ref={ref} onKeyPress={onKeyPress} /></pre>
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
                    <pre>{this.state.caughtError.message}</pre>
                </React.Fragment>
            )
        }

        return this.props.children
    }
}

const ExprValue = ({ value }) => {
    if (typeof value === 'function') {
        return (
            <ErrorBoundary>
                {React.createElement(value, null, null)}
            </ErrorBoundary>
        )
    }
    else if (React.isValidElement(value)) {
        return <ErrorBoundary>{value}</ErrorBoundary>
    }
    else if (value instanceof Error) {
        return (
            <React.Fragment>
                <h3>{value.name}</h3>
                <pre>{value.message}</pre>
            </React.Fragment>
        )
    }
    else if (value && typeof value === 'object') {
        return <pre>{"{" + Object.keys(value).join(", ") + "}"}</pre>
    }
    else {
        return <pre>{value + ""}</pre>
    }
}

const REPL_MODES = ['both', 'result', 'code']
const REPL_ICON = {
    both: (
        <React.Fragment>
            <FontAwesomeIcon icon={solidIcons.faCode} />
            <br />
            <FontAwesomeIcon icon={solidIcons.faPlay} />
        </React.Fragment>
    ),
    result: <FontAwesomeIcon icon={solidIcons.faPlay} />,
    code: <FontAwesomeIcon icon={solidIcons.faCode} />,
}

const nextElem = (elem, allElems) => {
    const elemIdx = allElems.findIndex(e => e === elem)
    const nextElemIdx = (elemIdx + 1) % allElems.length
    return allElems[nextElemIdx]
}

const REPLLine = styled.div`
    display: flex;
    flex-direction: row;
    gap: 5px;
`

const REPLContent = styled.div`
    display: flex;
    flex-direction: column;
`

const REPLModeButton = styled.button`
    background-color: transparent;
    color: #BBB;

    width: 25px;
    line-height: 200%;

    border-width: 0;
    border-radius: 5px;

    padding: 0;
    margin: 0;
    border: 0;

    transition: background-color .1s, color .1s;

    :hover {
        background-color: #f4f4f4;
        color: #444;
    }
    :active {
        background-color: #DDD;
        color: #333;
    }
`

const REPL = ({ code, onUpdate, onEnter }) => {
    const [mode, setMode] = React.useState(REPL_MODES[0])
    const [result, setResult] = React.useState([null])

    useEffect(() => {
        setResult([runExpr(code, { React, styled })])
    }, [code])

    const switchMode = () => {
        setMode(nextElem(mode, REPL_MODES))
    }

    return (
        <REPLLine>
            <REPLModeButton onClick={switchMode}>{REPL_ICON[mode]}</REPLModeButton>
            <REPLContent>
                {mode !== 'result' &&
                    <CodeEditor code={code} onUpdate={onUpdate} onRun={onEnter} />
                }
                {mode !== 'code' &&
                    <ExprValue value={result[0]} />
                }
            </REPLContent>
        </REPLLine>
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

const App = ({ state, onUpdate }) => {
    const [mode, setMode] = React.useState(APP_MODES[0])

    return (
        <React.Fragment>
            <button onClick={() => setMode(nextElem(mode, APP_MODES))}>{mode}</button>
            {mode === 'app' ?
                <div>
                    {state.cmds.map(
                        (cmd, idx) =>
                            <REPL
                                key={idx}
                                code={cmd}
                                onUpdate={newCmd =>
                                    onUpdate({
                                        ...state,
                                        cmds: state.cmds.map((cmd, i) => i === idx ? newCmd : cmd),
                                    })
                                }
                                onEnter={() => {}}
                                />
                    )}
                    <REPL
                        code={state.code}
                        onUpdate={code => onUpdate({ ...state, code })}
                        onEnter={() => {
                            onUpdate({
                                ...state,
                                cmds: [ ...state.cmds, state.code ],
                                code: "",
                            })
                        }}
                        />
                </div>
            :
                <StateEditor state={state} onUpdate={onUpdate} />
            }
        </React.Fragment>
    )
}

let state = { code: "" }
try {
    const storedState = localStorage.getItem('state')
    if (storedState) {
        state = JSON.parse(storedState)
    }
} catch (e) {}
function updateStore() {
    localStorage.setItem('state', JSON.stringify(state))
    setTimeout(updateStore, 10 * 1000)
}
updateStore()

const container = document.getElementById("app")
function renderApp() {
    const onUpdate = newState => {
        state = newState
        renderApp()
    }
    ReactDOM.render(
        <App state={state} onUpdate={onUpdate} />,
        container,
    )
}
renderApp()