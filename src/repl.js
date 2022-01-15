import React, { useEffect } from 'react'
import * as babel from '@babel/core'
import babelReact from '@babel/preset-react'
import * as babelParser from '@babel/parser'
import { useCodeJar } from 'react-codejar'
import Prism from 'prismjs'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { ValueViewer, ValueInspector, uninitializedAppState } from './value'
import { IconToggleButton, ToggleButton, TextInput, classed, onMetaEnter } from './ui'
import { subUpdate } from './utils'


/**************** User Code Execution **************/

export const runExpr = (code, env) => {
    if (!code) {
        return
    }
    try {
        const exprAst = babelParser.parseExpression(code, { plugins: [ "jsx" ] })
        const programAst = {
            type: 'Program',
            interpreter: null,
            sourceType: 'script',
            body: [
                {
                    type: "ReturnStatement",
                    argument: exprAst,
                },
            ],
            directives: [],
        }

        const { code: transformedCode } = babel.transformFromAstSync(
            programAst,
            code,
            {
                presets: [babelReact],
            },
        )

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

export const localEnv = (def, globalEnv) => {
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

export const defaultCodeUI = {
    isEnvVisible: true,
    isNameVisible: false,
    isCodeVisible: true,
    isResultVisible: true,
    isStateVisible: false,
}

export const emptyCode = {
    name: "",
    expr: "",
    ui: defaultCodeUI,
    state: uninitializedAppState,
    env: null,
}

export const highlightJS = editor => {
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


export const CodeEditor = ({ code, onUpdate, ...props }) => {
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



/**************** REPL *****************/

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

const REPLUIToggles = ({ ui, onUpdate, onReset, onDelete }) => {
    const [isMenuVisible, setMenuVisible] = React.useState(false)

    const Toggle = ({ propName, icon, iconDisabled, label }) => (
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
                    icon={solidIcons.faStepBackward}
                    onUpdate={onReset}
                    label="Reset App (data)"
                />
            </li>
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

export const REPL = ({ code, onUpdate, env }) => {
    const onUpdateExpr = expr => {
        onUpdate(code => ({ ...code, expr }))
    }

    const onCmdInsert = event => {
        if (event.shiftKey) {
            onUpdate(code => ({
                ...code,
                env: addNewDef({
                    ...emptyCode,
                    env: code.env
                }),
            }))
        }
        else {
            onUpdate(code => ({
                ...emptyCode,
                env: addNewDef(code),
            }))
        }
    }

    const onDelete = () => {
        onUpdate(code => code.env)
    }

    const onReset = () => {
        onUpdate(code => ({ ...code, state: uninitializedAppState }))
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
                <REPLUIToggles
                    ui={code.ui}
                    onUpdate={subUpdate('ui', onUpdate)}
                    onDelete={onDelete} onReset={onReset}
                />
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
                            onKeyPress={onMetaEnter(onCmdInsert)}
                        />
                    }
                    {code.ui.isResultVisible &&
                        <ValueViewer
                            value={runExpr(code.expr, localEnv(code.env, env))}
                            state={code.state}
                            setState={subUpdate('state', onUpdate)}
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




/****************** State Viewer ******************/

export const StateViewer = ({ state, onUpdate, env }) => {
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

export const StateEditor = ({ state, onUpdate, onClose, env }) => {
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