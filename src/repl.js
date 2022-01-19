import React, { useEffect } from 'react'
import * as babel from '@babel/core'
import babelReact from '@babel/preset-react'
import * as babelParser from '@babel/parser'
import { useCodeJar } from 'react-codejar'
import Prism from 'prismjs'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { ValueViewer, ValueInspector, initialAppState } from './value'
import { IconToggleButton, ToggleButton, TextInput, classed, onMetaEnter } from './ui'
import { nextElem, subUpdate } from './utils'


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
            sourceType: 'module',
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

export const getCodeById = (id, code) => {
    if (!code) { return null }
    if (code.id === id) { return code }
    return getCodeById(id, code.prev)
}

export const getNextId = code => after => {
    for (
        let id = after ? (after + 1) : 0;
        id < Number.MAX_SAFE_INTEGER;
        id++
    ) {
        if (!getCodeById(id, code)) {
            return id
        }
    }
}

export const localEnv = (code, globalEnv) => {
    if (!code) { return globalEnv }
    return {
        ...localEnv(code.prev, globalEnv),
        [getName(code)]: code.usageMode === 'use-result' ? code.cachedResult : code.state,
    }
}

export const precompute = (code, globalEnv, force=false) => {
    if (!code) { return null }
    const prev = precompute(code.prev, globalEnv, force)
    if (prev === code.prev && !code.invalidated && !force) { return code }
    const currentEnv = localEnv(prev, globalEnv)
    const cachedResult = runExpr(
        code.expr,
        {
            $$internals: { prev, currentEnv, globalEnv },
            ...currentEnv
        }
    )
    return {
        ...code,
        cachedResult,
        invalidated: false,
        prev,
    }
}

export const stripCachedResult = code => (
    code ?
        {
            ...code,
            prev: stripCachedResult(code.prev),
            cachedResult: null,
        }
    :
        null
)

const getOrDefault = (fieldName, input, defaults) =>
    input.hasOwnProperty(fieldName) ? input[fieldName] : defaults[fieldName]

export const rebuildCodeUIOptions = options => ({
    isNameVisible: getOrDefault('isNameVisible', options, defaultCodeUI),
    isCodeVisible: getOrDefault('isCodeVisible', options, defaultCodeUI),
    isResultVisible: getOrDefault('isResultVisible', options, defaultCodeUI),
    isStateVisible: getOrDefault('isStateVisible', options, defaultCodeUI),
})

export const rebuildCode = ({ id, name, expr, ui, state, usageMode, prev }) => {
    const rebuiltPrev = prev && rebuildCode(prev)
    return {
        id: id || getNextId(rebuiltPrev)(),
        name: name || "",
        expr: expr || "",
        ui: typeof ui === 'object' ? rebuildCodeUIOptions(ui) : defaultCodeUI,
        state,
        usageMode: usageMode || USAGE_MODES[0],
        cachedResult: null,
        invalidated: true,
        prev: rebuiltPrev,
    }
}

export const updateCode = (setCode, globalEnv) => update => {
    setCode(code => precompute(
        typeof update === 'function' ? update(code) : update,
        globalEnv,
    ))
}

export const USAGE_MODES = [ 'use-result', 'use-data' ]

export const defaultCodeUI = {
    isNameVisible: true,
    isCodeVisible: true,
    isResultVisible: true,
    isStateVisible: false,
}

export const emptyCode = {
    id: 0,
    name: "",
    expr: "",
    ui: defaultCodeUI,
    state: initialAppState,
    usageMode: USAGE_MODES[0],
    prev: null,
    cachedResult: null,
    invalidated: true,
}

export const getDefaultName = code => '$' + code.id
export const getName = code => code.name.length > 0 ? code.name : getDefaultName(code)

export const concatCode = (code, prevCode) =>
    code === null ? prevCode : { ...code, prev: concatCode(code.prev, prevCode) }

export const reindexCode = (code, nextId) => {
    if (!code) { return null }
    const prev = reindexCode(code.prev, nextId)
    const id = prev ? nextId(prev.id) : nextId()
    return { ...code, id, prev }
}



/**************** Code Editor *****************/

const CodeContent = classed('code')`
    block
    min-h-1
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

export const highlightJS = editor => {
    const text = editor.textContent
    editor.innerHTML = Prism.highlight(
        text,
        Prism.languages.javascript,
        'javascript'
    )
}



/**************** REPL *****************/

const toggleProperty = propName => obj => (
    { ...obj, [propName]: !obj[propName] }
)

const MenuHTML = classed('div')`
    flex flex-col
    bg-gray-100
    shadow
    rounded
    items-stretch
    w-max
    text-sm
    overflow-hidden
    z-10
    outline-none
`

const REPLUIToggles = ({ ui, onUpdate, name, usageMode, onSwitchUsageMode, onInsertBefore, onInsertAfter, onReset, onDelete }) => {
    const [isMenuVisible, setMenuVisible] = React.useState(false)
    const menuRef = React.useRef(null)

    React.useEffect(() => {
        if (menuRef.current && isMenuVisible) {
            menuRef.current.focus()
        }
    })

    const Toggle = ({ propName, icon, iconDisabled, label, ...props }) => (
            <IconToggleButton
                className="w-full"
                isActive={ui[propName]}
                icon={icon}
                iconDisabled={iconDisabled}
                onUpdate={() => onUpdate(toggleProperty(propName))}
                label={`${ui[propName] ? "Hide" : "Show"} ${label}`}
                {...props}
            />
    )

    const dismissMenu = event => {
        if (!event.relatedTarget) {
            setMenuVisible(false)
            return
        }
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setMenuVisible(false)
            return
        }
    }

    const Menu = () => (
        <MenuHTML
            className={`absolute -right-1 translate-x-full ${isMenuVisible ? '' : 'hidden'}`}
            onBlur={dismissMenu}
            ref={menuRef}
            tabIndex={-1}
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
            <IconToggleButton
                className="w-full"
                isActive={true}
                icon={solidIcons.faChevronUp}
                onUpdate={onInsertBefore}
                label="Insert before"
            />
            <IconToggleButton
                className="w-full"
                isActive={true}
                icon={solidIcons.faChevronDown}
                onUpdate={onInsertAfter}
                label="Insert after"
            />
            <IconToggleButton
                className="w-full"
                isActive={true}
                icon={solidIcons.faDollarSign}
                onUpdate={onSwitchUsageMode}
                label={`Save ${usageMode === 'use-result' ? "code result" : "app data"} in ${name}`}
                />
            <IconToggleButton
                className="w-full"
                isActive={true}
                icon={solidIcons.faStepBackward}
                onUpdate={onReset}
                label="Reset App (data)"
            />
            <IconToggleButton
                className="w-full"
                isActive={true}
                icon={solidIcons.faTrash}
                onUpdate={onDelete}
                label="Delete"
            />
        </MenuHTML>
    )

    return (
        <div>
            <div className="relative">
                <Menu />
            </div>
            <button
                className="px-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                onClick={() => { setMenuVisible(visible => !visible) }}
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


export const REPL = ({ code, onUpdate, nextId, globalEnv }) => {
    const onUpdateExpr = expr => {
        onUpdate(code => ({
            ...code,
            invalidated: true,
            expr,
        }))
    }

    const switchUsageMode = () => {
        onUpdate(code => {
            console.log('usage mode', code.usageMode, nextElem(code.usageMode, USAGE_MODES))
            return ({
            ...code,
            invalidated: true,
            usageMode: nextElem(code.usageMode, USAGE_MODES),
        })})
    }

    const onUpdateName = name => {
        onUpdate(code => ({ ...code, name }))
    }

    const onInsertBefore = () => {
        onUpdate(code => ({
            ...code,
            prev: {
                ...emptyCode,
                id: nextId(),
                prev: code.prev
            },
        }))
    }

    const onInsertAfter = () => {
        onUpdate(code => ({
            ...emptyCode,
            id: nextId(),
            prev: code,
        }))
    }

    const onCmdInsert = event => {
        if (event.shiftKey) {
            onInsertBefore()
        }
        else {
            onInsertAfter()
        }
    }

    const onDelete = () => {
        onUpdate(code => code.prev || emptyCode)
    }

    const onReset = () => {
        onUpdate(code => ({ ...code, state: initialAppState }))
    }

    const updatePrev = update => {
        onUpdate(code => {
            const newPrev = update(code.prev)
            return { ...code, prev: newPrev }
        })
    }

    return (
        <React.Fragment>
            {code.prev &&
                <REPL
                    key={code.id}
                    code={code.prev}
                    onUpdate={updatePrev}
                    globalEnv={globalEnv}
                    nextId={nextId}
                />
            }
            <REPLLine>
                <REPLUIToggles
                    ui={code.ui}
                    onUpdate={subUpdate('ui', onUpdate)}
                    name={getName(code)}
                    usageMode={code.usageMode}
                    onSwitchUsageMode={switchUsageMode}
                    onInsertBefore={onInsertBefore} onInsertAfter={onInsertAfter}
                    onDelete={onDelete} onReset={onReset}
                />
                <REPLContent>
                    {code.ui.isNameVisible &&
                        <div className="self-start text-slate-500 font-light text-xs -mb-1">
                            <VarNameInput
                                value={code.name}
                                onUpdate={onUpdateName}
                                placeholder={getDefaultName(code)}
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
                            value={code.cachedResult}
                            state={code.state}
                            setState={subUpdate('state', onUpdate)}
                        />
                    }
                    {code.ui.isStateVisible &&
                        <StateViewer
                            state={code.state}
                            onUpdate={subUpdate('state', onUpdate)}
                            env={localEnv(code.prev, globalEnv)}
                        />
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
    const globalEnv = { ...env, state }
    const initCode = { ...emptyCode, expr: "state" }
    const [code, setCode] = React.useState(() => precompute(initCode, globalEnv))

    const setCodeAndCompute = updateCode(setCode, globalEnv)

    useEffect(() => {
        try {
            onUpdate(JSON.parse(stateJSON))
            setValidJSON(true)
        }
        catch (e) {
            setValidJSON(false)
        }
    }, [stateJSON])

    const onSaveComputed = newState => () => {
        onUpdate(newState)
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
                        <REPL
                            code={code}
                            onUpdate={setCodeAndCompute}
                            globalEnv={globalEnv}
                        />
                        <button onClick={onSaveComputed(code.cachedResult)}>Save</button>
                    </React.Fragment>
                }
            </div>
        </div>
    )
}