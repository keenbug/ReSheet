import React from 'react'
import { Popover } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { ValueViewer, ValueInspector, initialBlockState } from './value'
import { EditableCode } from './code-editor'
import { IconToggleButton, TextInput, classed, onMetaEnter } from './ui'
import { nextElem, runUpdate } from './utils'


/**************** Code Actions **************/


export const setCodeExpr = (id, expr, wholeCode) =>
    wholeCode.updateExprWithId(id, expr)

export const switchUsageMode = (id, wholeCode) =>
    wholeCode
        .invalidateWithId(id)
        .mapWithId(
            id,
            code => code.update({
                usageMode: nextElem(code.usageMode, USAGE_MODES),
            }),
        )

export const setName = (id, name, wholeCode) =>
    wholeCode
        .invalidateWithId(id)
        .mapWithId(id, code => code.update({ name }))

export const updateState = (id, stateUpdate, wholeCode) =>
    wholeCode
        .applyWhen(
            code.usageMode === 'use-data',
            code => code.invalidateWithId(id),
        )
        .mapWithId(
            id,
            code => code.update({
                state: runUpdate(stateUpdate, code.state),
            }),
        )

export const switchAutorun = (id, wholeCode) =>
    wholeCode.mapWithId(
        id,
        code => code.update({ autorun: !code.autorun }),
    )

export const runCode = (id, wholeCode) =>
    wholeCode.mapWithId(
        id,
        code => code.update({ invalidated: true }),
    )

export const insertBeforeCode = (id, insert, wholeCode) =>
    wholeCode.mapWithId(
        id,
        code => code.update({
            prev: insert.update({
                id: wholeCode.getNextFreeId(),
                prev: code.prev
            })
        }),
    )

export const insertAfterCode = (id, insert, wholeCode) =>
    wholeCode.mapWithId(
        id,
        code => insert.update({ id: wholeCode.getNextFreeId(), prev: code }),
    )

export const deleteCode = (id, wholeCode) =>
    id === wholeCode.id ?
        (wholeCode.prev || CodeComponent)
    :
        wholeCode.mapWithId(id, code => code.prev)

export const resetStateCode = (id, wholeCode) =>
    wholeCode
        .applyWhen(
            code.usageMode === 'use-data',
            code => code.invalidateWithId(id),
        )
        .mapWithId(id, code => code.update({ state: initialBlockState }))

export const updateUIOption = (id, uiUpdater, wholeCode) =>
    wholeCode.mapWithId(
        id,
        code => code.udpate({ ui: uiUpdater(code.ui) }),
    )




/**************** UI *****************/


const REPLLine = classed('div')`flex flex-row space-x-2`
const REPLContent = classed('div')`flex flex-col space-y-1 flex-1`

const VarNameInput = classed(TextInput)`
    hover:bg-gray-200 hover:text-slate-700
    focus:bg-gray-200 focus:text-slate-700
    outline-none
    p-0.5 -ml-0.5
    rounded
`


export const REPL = ({ code, dispatch }) => {
    const onUpdateExpr    = expr        => dispatch(setCodeExpr,      code.id, expr)
    const onUpdateState   = stateUpdate => dispatch(updateState,      code.id, stateUpdate)
    const onSwitchAutorun = ()          => dispatch(switchAutorun,    code.id)
    const onRun           = ()          => dispatch(runCode,          code.id)
    const onInsertBefore  = ()          => dispatch(insertBeforeCode, code.id, CodeComponent)
    const onInsertAfter   = ()          => dispatch(insertAfterCode,  code.id, CodeComponent)

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
                    placeholder={code.getDefaultName()}
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
    const onInsertBefore    = () => dispatch(insertBeforeCode, code.id, CodeComponent)
    const onInsertAfter     = () => dispatch(insertAfterCode,  code.id, CodeComponent)
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
            <Button onUpdate={onSwitchUsageMode} icon={solidIcons.faDollarSign}   label={`Save ${code.usageMode === 'use-result' ? "code result" : "block data"} in ${code.getName()}`} />
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
