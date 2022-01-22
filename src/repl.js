import React from 'react'
import { Popover } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import * as babel from '@babel/core'
import babelReact from '@babel/preset-react'
import * as babelParser from '@babel/parser'
import babelGenerator from '@babel/generator'

import { ValueViewer, ValueInspector, initialBlockState } from './value'
import { EditableCode } from './code-editor'
import { IconToggleButton, TextInput, classed, onMetaEnter } from './ui'
import { nextElem, runUpdate } from './utils'


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

export const getNextId = (code, after) => {
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

export const sanitizeCodeUIOptions = options => ({
    isNameVisible:   getOrDefault('isNameVisible',   options, defaultCodeUI),
    isCodeVisible:   getOrDefault('isCodeVisible',   options, defaultCodeUI),
    isResultVisible: getOrDefault('isResultVisible', options, defaultCodeUI),
    isStateVisible:  getOrDefault('isStateVisible',  options, defaultCodeUI),
})

export const sanitizeCode = code => {
    const { id, name, expr, ui, state, usageMode, prev } = code
    const rebuiltPrev = prev && sanitizeCode(prev)
    return {
        id: id || getNextId(rebuiltPrev),
        name: name || "",
        expr: expr || "",
        ui: typeof ui === 'object' ? sanitizeCodeUIOptions(ui) : defaultCodeUI,
        state,
        usageMode: usageMode || USAGE_MODES[0],
        cachedResult: null,
        invalidated: true,
        autorun: code.hasOwnProperty('autorun') ? code.autorun : true,
        prev: rebuiltPrev,
    }
}

export const USAGE_MODES = [ 'use-result', 'use-data' ]

export const defaultCodeUI = {
    isNameVisible: true,
    isCodeVisible: true,
    isResultVisible: true,
    isStateVisible: false,
}

export const createEntity = (...components) =>
    components.reduce(
        (entity, component) => ({
            ...entity,
            ...component(entity)
        }),
        {},
    )

export const stateComponent = state => _ => state

export const emptyCode = createEntity(
    stateComponent({
        expr: "",
    }),
    stateComponent({
        id: 0,
        name: "",
        prev: null,
    }),
    stateComponent({
        cachedResult: null,
        invalidated: true,
    }),
    stateComponent({
        state: initialBlockState,
        usageMode: USAGE_MODES[0],
    }),
    stateComponent({
        ui: defaultCodeUI,
    }),
    stateComponent({
        autorun: true,
    }),
)

export const getDefaultName = code => '$' + code.id
export const getName = code => code.name.length > 0 ? code.name : getDefaultName(code)

export const codeList = code =>
    code ?
        [ code, ...codeList(code.prev) ]
    :
        []

export const appendCode = (code, prevCode) =>
    code === null ? prevCode : { ...code, prev: appendCode(code.prev, prevCode) }

export const concatCode = codes => codes.reduceRight((prev, cur) => appendCode(cur, prev), null)

export const reindexCode = (code, nextId) => {
    if (!code) { return null }
    const prev = reindexCode(code.prev, nextId)
    const id = prev ? nextId(prev.id) : nextId()
    return { ...code, id, prev }
}




/**************** JS Importer *****************/

export const parseJsCode = (code, libMappings) => {
    const ast = babelParser.parse(code, { sourceType: 'module', plugins: [ 'jsx' ] })
    return ast.program.body.map(code => parseJsAstNode(code, libMappings))
}

export const parseJsAstNode = (node, libMappings) => {
    const codeWithoutResult = { ...emptyCode, ui: { ...emptyCode.ui, isResultVisible: false } }
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
    else if (node.type === 'ImportDeclaration') {
        return {
            ...codeWithoutResult,
            name: mapImportAssignment(node.specifiers),
            expr: mapImportSource(node.source.value, libMappings)
        }
    }
    else {
        return {
            ...emptyCode,
            expr: babelGenerator(node).code,
        }
    }
}

const mapImport = node => (
  node.local.name === node.imported.name ?
    node.local.name
  : (
    node.imported.name + ': ' + node.local.name
  )
)

const mapImportSpecifier = node =>
  node.type === "ImportDefaultSpecifier" ?
    `default: ${node.local.name}`
  : node.type === "ImportSpecifier" ?
    mapImport(node)
  :
    generator(node).code


const mapImportAssignment = specifiers =>
  specifiers[0].type === "ImportNamespaceSpecifier" ?
    specifiers[0].local.name
  : (
    "{ " + specifiers.map(mapImportSpecifier).join(", ") + " }"
  )

export const mapImportSource = (source, libMappings) => (
    libMappings[source] || `import(${JSON.stringify(source)})`
)


export const exportJsCode = code =>
    codeList(code)
        .map(block =>
            `const ${getName(block)} = ${block.expr}`
        )
        .reverse()
        .join("\n\n")






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


export const updateCodeWithId = (id, update, code) =>
    code && (
        code.id === id ?
            update(code)
        : (
            { ...code, prev: updateCodeWithId(id, update, code.prev) }
        )
    )

export const setCodeExpr = (id, expr, wholeCode) =>
    updateCodeWithId(
        id,
        code => ({
            ...code,
            expr,
            invalidated: code.autorun
        }),
        wholeCode,
    )

export const switchUsageMode = (id, wholeCode) =>
    updateCodeWithId(
        id,
        code => ({
            ...code,
            invalidated: code.autorun,
            usageMode: nextElem(code.usageMode, USAGE_MODES),
        }),
        wholeCode,
    )

export const setName = (id, name, wholeCode) =>
    updateCodeWithId(
        id,
        code => ({ ...code, name }),
        wholeCode,
    )

export const updateState = (id, stateUpdate, wholeCode) =>
    updateCodeWithId(
        id,
        code => ({
            ...code,
            invalidated: code.usageMode === 'use-data' ? code.autorun : code.invalidated,
            state: runUpdate(stateUpdate, code.state),
        }),
        wholeCode,
    )

export const switchAutorun = (id, wholeCode) =>
    updateCodeWithId(
        id,
        code => ({ ...code, autorun: !code.autorun }),
        wholeCode,
    )

export const runCode = (id, wholeCode) =>
    updateCodeWithId(
        id,
        code => ({ ...code, invalidated: true }),
        wholeCode,
    )

export const insertBeforeCode = (id, insert, wholeCode) =>
    updateCodeWithId(
        id,
        code => ({ ...code, prev: { ...insert, id: getNextId(wholeCode), prev: code.prev } }),
        wholeCode,
    )

export const insertAfterCode = (id, insert, wholeCode) =>
    updateCodeWithId(
        id,
        code => ({ ...insert, id: getNextId(wholeCode), prev: code }),
        wholeCode,
    )

export const deleteCode = (id, wholeCode) =>
    id === wholeCode.id ?
        (wholeCode.prev || emptyCode)
    :
        updateCodeWithId(
            id,
            code => code.prev,
            wholeCode,
        )

export const resetStateCode = (id, wholeCode) =>
    updateCodeWithId(
        id,
        code => ({
            ...code,
            invalidated: code.usageMode === 'use-data' ? code.autorun : code.invalidated,
            state: initialBlockState
        }),
        wholeCode,
    )

export const updateUIOption = (id, uiUpdater, wholeCode) =>
    updateCodeWithId(
        id,
        code => ({ ...code, ui: uiUpdater(code.ui) }),
        wholeCode,
    )


export const REPL = ({ code, dispatch }) => {
    const onUpdateExpr    = expr        => dispatch(setCodeExpr,      code.id, expr)
    const onUpdateState   = stateUpdate => dispatch(updateState,      code.id, stateUpdate)
    const onSwitchAutorun = ()          => dispatch(switchAutorun,    code.id)
    const onRun           = ()          => dispatch(runCode,          code.id)
    const onInsertBefore  = ()          => dispatch(insertBeforeCode, code.id, emptyCode)
    const onInsertAfter   = ()          => dispatch(insertAfterCode,  code.id, emptyCode)

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

    const onCmdInsert = event => {
        if (event.shiftKey) {
            onInsertBefore()
        }
        else {
            onInsertAfter()
        }
    }

    return (
        <React.Fragment>
            {code.prev &&
                <REPL code={code.prev} dispatch={dispatch} />
            }
            <REPLLine key={code.id}>
                <REPLUIToggles code={code} dispatch={dispatch} />
                <REPLContent>
                    {code.ui.isNameVisible &&
                        <AssignmentLine code={code} dispatch={dispatch} />
                    }
                    {code.ui.isCodeVisible &&
                        <EditableCode code={code.expr} onUpdate={onUpdateExpr} onKeyPress={onKeyPress} />
                    }
                    {code.ui.isResultVisible &&
                        <ValueViewer value={code.cachedResult} state={code.state} setState={onUpdateState} />
                    }
                    {code.ui.isStateVisible &&
                        <ValueInspector value={code.state} />
                    }
                </REPLContent>
            </REPLLine>
        </React.Fragment>
    )
}


export const AssignmentLine = ({ code, dispatch }) => {
    const onUpdateName    = name => dispatch(setName,       code.id, name)
    const onSwitchAutorun = ()   => dispatch(switchAutorun, code.id)
    const onRun           = ()   => dispatch(runCode,       code.id)

    return (
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
    )
}




/****************** REPL Popover ******************/

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

const REPLUIToggles = ({ code, dispatch }) => {
    const onInsertBefore    = () => dispatch(insertBeforeCode, code.id, emptyCode)
    const onInsertAfter     = () => dispatch(insertAfterCode,  code.id, emptyCode)
    const onReset           = () => dispatch(resetStateCode,   code.id)
    const onSwitchUsageMode = () => dispatch(switchUsageMode,  code.id)
    const onDelete          = () => dispatch(deleteCode,       code.id)

    const Toggle = ({ propName, icon, iconDisabled, label, ...props }) => {
        const onToggle = () =>
            dispatch(
                updateUIOption,
                code.id,
                ui => ({ ...ui, [propName]: !ui[propName] }),
            )

        return (
            <IconToggleButton
                className="w-full"
                isActive={code.ui[propName]}
                icon={icon}
                iconDisabled={iconDisabled}
                onUpdate={onToggle}
                label={`${code.ui[propName] ? "Hide" : "Show"} ${label}`}
                {...props}
            />
        )
    }
    
    const Button = props => (
        <IconToggleButton className="w-full" isActive={true} {...props} />
    )

    const Menu = () => (
        <PopoverPanelStyled className="absolute -right-1 translate-x-full">
            <Toggle propName="isNameVisible"     icon={solidIcons.faICursor}      label="Assignment"         />
            <Toggle propName="isCodeVisible"     icon={solidIcons.faCode}         label="Code"               />
            <Toggle propName="isResultVisible"   icon={solidIcons.faPlay}         label="Result"             />
            <Toggle propName="isStateVisible"    icon={solidIcons.faHdd}          label="State"              />
            <Button onUpdate={onInsertBefore}    icon={solidIcons.faChevronUp}    label="Insert before"      />
            <Button onUpdate={onInsertAfter}     icon={solidIcons.faChevronDown}  label="Insert after"       />
            <Button onUpdate={onSwitchUsageMode} icon={solidIcons.faDollarSign}   label={`Save ${code.usageMode === 'use-result' ? "code result" : "block data"} in ${getName(code)}`} />
            <Button onUpdate={onReset}           icon={solidIcons.faStepBackward} label="Reset Block (data)" />
            <Button onUpdate={onDelete}          icon={solidIcons.faTrash}        label="Delete"             />
        </PopoverPanelStyled>
    )

    return (
        <div>
            <Popover className="relative">
                <Menu />
                <Popover.Button className="px-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                    <FontAwesomeIcon size="xs" icon={solidIcons.faGripVertical} />
                </Popover.Button>
            </Popover>
        </div>
    )
}
