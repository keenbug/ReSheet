import React from 'react'
import { Popover } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { CodeFCO, createBlock } from '../logic/components'
import { ValueInspector } from '../ui/value'
import { EditableCode } from '../ui/code-editor'
import { IconToggleButton, TextInput, classed } from '../ui/utils'
import { nextElem } from '../utils'
import { FCO } from '../logic/fc-object'


/**************** Code Actions **************/


export const setCodeExpr = (id, expr, block) =>
    block.update({ code: block.code.updateExprWithId(id, expr) })

export const switchUsageMode = (id, block) =>
    block.update({ code: block.code
        .invalidateWithId(id)
        .mapWithId(
            id,
            code => code.update({
                usageMode: nextElem(code.usageMode, USAGE_MODES),
            }),
        )
    })

export const setName = (id, name, block) =>
    block.update({ code: block.code
        .invalidateWithId(id)
        .mapWithId(id, code => code.update({ name }))
    })

export const switchAutorun = (id, block) =>
    block.update({ code: block.code
        .mapWithId(
            id,
            code => code.update({ autorun: !code.autorun }),
        )
    })

export const runCode = (id, block) =>
    block.update({ code: block.code
        .mapWithId(
            id,
            code => code.update({ invalidated: true }),
        )
    })

export const insertBeforeCode = (id, insert, block) =>
    block.update({ code: block.code
        .mapWithId(
            id,
            code => code.update({
                prev: insert.update({
                    id: wholeCode.getNextFreeId(),
                    prev: code.prev
                })
            }),
        )
    })

export const insertAfterCode = (id, insert, block) =>
    block.update({ code: block.code
        .mapWithId(
            id,
            code => insert.update({ id: block.code.getNextFreeId(), prev: code }),
        )
    })

export const deleteCode = (id, block) =>
    block.update({ code:
        id === block.code.id ?
            (block.code.prev || CodeFCO)
        :
            block.code.mapWithId(id, code => code.prev)
    })

export const updateUIOption = (id, uiUpdater, block) =>
    block.update({ code: block.code
        .mapWithId(
            id,
            code => code.udpate({ ui: uiUpdater(code.ui) }),
        )
    })




/**************** UI *****************/


const REPLLineContainer = classed('div')`flex flex-row space-x-2`
const REPLContent = classed('div')`flex flex-col space-y-1 flex-1`

const VarNameInput = classed(TextInput)`
    hover:bg-gray-200 hover:text-slate-700
    focus:bg-gray-200 focus:text-slate-700
    outline-none
    p-0.5 -ml-0.5
    rounded
`


export const REPLBlock = library => FCO
    .addState({ code: CodeFCO })
    .addMethods({
        fromJSON(json) {
            return this.update({ code: this.code.fromJSON(json).precomputeAll(library) })
        },
        toJSON() {
            return this.code.toJSON()
        },
        view({ block, setBlock }) {
            const dispatch = (action, ...args) => {
                setBlock(block => {
                    const newBlock = action(...args, block)
                    return newBlock.update({ code: newBlock.code.precomputeAll(library) })
                })
            }
            return <REPL block={block} dispatch={dispatch} />
        }
    })
    .pipe(createBlock)

export const REPL = ({ block, dispatch }) => (
    <React.Fragment>
        {block.code.toList().reverse().map(code =>
            <REPLLine key={code.id} code={code} dispatch={dispatch} />
        )}
    </React.Fragment>
)


export const REPLLine = ({ code, dispatch }) => {
    const onUpdateExpr    = expr => dispatch(setCodeExpr,      code.id, expr)
    const onSwitchAutorun = ()   => dispatch(switchAutorun,    code.id)
    const onRun           = ()   => dispatch(runCode,          code.id)
    const onInsertBefore  = ()   => dispatch(insertBeforeCode, code.id, CodeFCO)
    const onInsertAfter   = ()   => dispatch(insertAfterCode,  code.id, CodeFCO)

    const onKeyPress = event => {
        if (event.key === 'Enter' && event.metaKey) {
            onCmdInsert(event)
        }
        else if (event.altKey && event.key === 'Enter') {
            if (event.shiftKey) {
                event.preventDefault()
                event.stopPropagation()
                onSwitchAutorun()
            }
            else {
                event.preventDefault()
                event.stopPropagation()
                onRun()
            }
        }
    }

    const onCmdInsert = event => {
        if (event.shiftKey) {
            event.preventDefault()
            event.stopPropagation()
            onInsertBefore()
        }
        else {
            event.preventDefault()
            event.stopPropagation()
            onInsertAfter()
        }
    }

    return (
        <REPLLineContainer key={code.id}>
            <REPLUIToggles code={code} dispatch={dispatch} />
            <REPLContent>
                {code.ui.isNameVisible &&
                    <AssignmentLine code={code} dispatch={dispatch} />
                }
                {code.ui.isCodeVisible &&
                    <EditableCode code={code.expr} onUpdate={onUpdateExpr} onKeyPress={onKeyPress} />
                }
                {code.ui.isResultVisible &&
                    <ValueInspector value={code.cachedResult} />
                }
                {code.ui.isStateVisible &&
                    <ValueInspector value={code.state} />
                }
            </REPLContent>
        </REPLLineContainer>
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
    const onInsertBefore    = () => dispatch(insertBeforeCode, code.id, CodeFCO)
    const onInsertAfter     = () => dispatch(insertAfterCode,  code.id, CodeFCO)
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
