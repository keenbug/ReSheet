import React from 'react'
import { Popover } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import * as babel from '@babel/core'
import babelReact from '@babel/preset-react'
import * as babelParser from '@babel/parser'
import babelGenerator from '@babel/generator'

import { ValueViewer, ValueInspector, initialAppState } from './value'
import { EditableCode } from './code-editor'
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

export const rebuildCode = code => {
    const { id, name, expr, ui, state, usageMode, autorun, prev } = code
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
        autorun: code.hasOwnProperty('autorun') ? code.autorun : true,
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
    autorun: true,
}

export const getDefaultName = code => '$' + code.id
export const getName = code => code.name.length > 0 ? code.name : getDefaultName(code)

export const concatCode = (code, prevCode) =>
    code === null ? prevCode : { ...code, prev: concatCode(code.prev, prevCode) }

export const linkCodes = codes => codes.reduceRight((prev, cur) => concatCode(cur, prev), null)

export const reindexCode = (code, nextId) => {
    if (!code) { return null }
    const prev = reindexCode(code.prev, nextId)
    const id = prev ? nextId(prev.id) : nextId()
    return { ...code, id, prev }
}




/**************** JS Importer *****************/

export const parseJsCode = code => {
    const ast = babelParser.parse(code, { sourceType: 'module', plugins: [ 'jsx' ] })
    return ast.program.body.map(parseJsAstNode)
}

export const parseJsAstNode = node => {
    if (node.type === 'ExportNamedDeclaration') {
        return {
            ...emptyCode,
            name: node.declaration.declarations[0].id.name,
            expr: babelGenerator(node.declaration.declarations[0].init).code,
        }
    }
    else if (node.type === 'VariableDeclaration') {
        return {
            ...emptyCode,
            name: node.declarations[0].id.name,
            expr: babelGenerator(node.declarations[0].init).code,
        }
    }
    else {
        return {
            ...emptyCode,
            expr: babelGenerator(node).code,
        }
    }
}





/**************** REPL *****************/



const REPLLine = classed('div')`flex flex-row space-x-2`
const REPLContent = classed('div')`flex flex-col space-y-1 flex-1`

const VarNameInput = classed(TextInput)`
    hover:bg-gray-200 hover:text-slate-700
    focus:bg-gray-200 focus:text-slate-700
    outline-none
    p-0.5 -ml-0.5
    rounded
`


export const setFields = newFields => object => ({ ...object, ...newFields })

export const mapCode = (fn, code) => code && ({
    ...fn(code),
    prev: mapCode(fn, code.prev),
})

export const updateCodeWithId = (id, update) => code =>
    mapCode(
        code => code.id === id ? update(code) : code,
        code,
    )

export const setCodeExpr = (id, expr) =>
    updateCodeWithId(id, setFields({ expr }))


export const REPL = ({ code, onUpdate, nextId, globalEnv }) => {
    const onUpdateExpr = expr => {
        onUpdate(code => ({
            ...code,
            invalidated: code.autorun,
            expr,
        }))
    }

    const switchUsageMode = () => {
        onUpdate(code => {
            console.log('usage mode', code.usageMode, nextElem(code.usageMode, USAGE_MODES))
            return ({
            ...code,
            invalidated: code.autorun,
            usageMode: nextElem(code.usageMode, USAGE_MODES),
        })})
    }

    const onUpdateName = name => {
        onUpdate(code => ({ ...code, name }))
    }

    const onUpdateState = update => {
        onUpdate(code => ({
            ...code,
            state: typeof update === 'function' ? update(code.state) : update,
            invalidated: code.usageMode === 'use-data' ? code.autorun : code.invalidated,
        }))
    }

    const onSwitchAutorun = () => {
        onUpdate(code => ({ ...code, autorun: !code.autorun }))
    }

    const onRun = () => {
        onUpdate(code => ({ ...code, invalidated: true }))
    }

    const onKeyPress = event => {
        onMetaEnter(onCmdInsert)(event)
        if (event.altKey && event.key === 'Enter') {
            if (event.shiftKey) {
                onSwitchAutorun()
            }
            else {
                onRun()
            }
        }
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
                        <div className="flex self-stretch space-x-2 pr-2 -mb-1 text-slate-500 font-light text-xs">
                            <div>
                                <VarNameInput
                                    value={code.name}
                                    onUpdate={onUpdateName}
                                    placeholder={getDefaultName(code)}
                                />
                                &nbsp;=
                            </div>
                            <div className="flex-1" />
                            <button onClick={onSwitchAutorun}>
                                {code.autorun || "No "}
                                Autorun
                            </button>
                            <button onClick={onRun}>
                                Run
                            </button>
                        </div>
                    }
                    {code.ui.isCodeVisible &&
                        <EditableCode
                            code={code.expr}
                            onUpdate={onUpdateExpr}
                            onKeyPress={onKeyPress}
                        />
                    }
                    {code.ui.isResultVisible &&
                        <ValueViewer
                            value={code.cachedResult}
                            state={code.state}
                            setState={onUpdateState}
                        />
                    }
                    {code.ui.isStateVisible &&
                        <ValueInspector value={code.state} />
                    }
                </REPLContent>
            </REPLLine>
        </React.Fragment>
    )
}





/****************** REPL Popover ******************/

const toggleProperty = propName => obj => (
    { ...obj, [propName]: !obj[propName] }
)

const PopoverPanelStyled = classed(Popover.Panel)`
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

    const Menu = () => (
        <PopoverPanelStyled
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
        </PopoverPanelStyled>
    )

    return (
        <div>
            <Popover className="relative">
                <Menu />
                <Popover.Button
                    className="px-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                    <FontAwesomeIcon size="xs" icon={solidIcons.faGripVertical} />
                </Popover.Button>
            </Popover>
        </div>
    )
}
