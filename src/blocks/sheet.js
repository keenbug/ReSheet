import React from 'react'
import { Popover } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { createBlock } from '../logic/components'
import { IconToggleButton, TextInput, classed } from '../ui/utils'
import { FCO } from '../logic/fc-object'


const lineDefaultName = line => '$' + line.id
const lineName = line => line.name.length > 0 ? line.name : lineDefaultName(line)

const nextFreeId = lines =>
    lines
        .map(line => line.id)
        .reduce(
            (usedId, idCandidate) =>
                idCandidate <= usedId ?
                    usedId + 1
                :
                    idCandidate
            ,
            0,
        )

const updateLineWithId = (id, update, lines) =>
    lines.map(line => line.id === id ? update(line) : line)

const insertLineBefore = (id, newLine, lines) =>
    lines.flatMap(line =>
        line.id === id ?
            [newLine, line]
        :
            [line]
    )

const insertLineAfter = (id, newLine, lines) =>
    lines.flatMap(line =>
        line.id === id ?
            [line, newLine]
        :
            [line]
    )

const resultLinesToEnv = resultLines =>
    Object.fromEntries(
        resultLines.map(line => [lineName(line), line.result])
    )


/**************** Code Actions **************/


export const updateLineBlock = (id, update, block) =>
    block.update({ lines: updateLineWithId(id, line => ({ ...line, block: update(line.block) }), block.lines) })

export const setName = (id, name, block) =>
    block.update({ lines: updateLineWithId(id, line => ({ ...line, name }), block.lines) })

export const insertBeforeCode = (id, block) =>
    block.update({ lines: insertLineBefore(id, { id: nextFreeId(block.lines), name: '', block: block.innerBlock }, block.lines) })

export const insertAfterCode = (id, block) =>
    block.update({ lines: insertLineAfter(id, { id: nextFreeId(block.lines), name: '', block: block.innerBlock }, block.lines) })

export const deleteCode = (id, block) =>
    block.lines.length > 1 ?
        block.update({ lines: block.lines.filter(line => line.id !== id) })
    :
        block




/**************** UI *****************/


const SheetLineContainer = classed('div')`flex flex-row space-x-2`
const SheetLineContent = classed('div')`flex flex-col space-y-1 flex-1`

const VarNameInput = classed(TextInput)`
    hover:bg-gray-200 hover:text-slate-700
    focus:bg-gray-200 focus:text-slate-700
    outline-none
    p-0.5 -ml-0.5
    rounded
`


export const SheetBlock = innerBlock => FCO
    .addState({
        innerBlock,
        lines: [{ id: 0, name: '', block: innerBlock }],
    })
    .addMethods({
        fromJSON(json, env) {
            return this.update({
                lines: json
                    .reduce(
                        (prevLines, { id, name, block}) => {
                            const localEnv = { ...env, ...resultLinesToEnv(prevLines) }
                            const loadedBlock = innerBlock.fromJSON(block, localEnv)
                            const result = loadedBlock.getResult(localEnv)
                            return [
                                ...prevLines,
                                { id, name, block: loadedBlock, result }
                            ]
                        },
                        []
                    )
                    .map(({ id, name, block }) => ({ id, name, block }))
            })
        },
        toJSON() {
            return this.lines.map(({ id, name, block }) => ({ id, name, block: block.toJSON() }))
        },
        view({ block, setBlock, env }) {
            const dispatch = (action, ...args) => {
                setBlock(self => action(...args, self))
            }
            return <Sheet block={block} dispatch={dispatch} env={env} />
        },
        getResultLines(env) {
            return this.lines.reduce(
                (previousResultLines, { id, name, block }) =>
                    [
                        ...previousResultLines,
                        {
                            id, name,
                            result: block.getResult({
                                ...env,
                                ...resultLinesToEnv(previousResultLines),
                            })
                        },
                    ]
                ,
                []
            )
        },
        getResult(env) {
            const resultLines = this.getResultLines(env)
            return resultLines[resultLines.length - 1]
        },
    })
    .pipe(createBlock)

export const Sheet = ({ block, dispatch, env }) => (
    <React.Fragment>
        {block.lines.reduce(
            (previousLines, line) => {
                const { id, name, block } = line
                const localEnv = resultLinesToEnv(previousLines)
                return [
                    ...previousLines,
                    {
                        id, name,
                        result: block.getResult(env),
                        view: <SheetLine key={id} line={line} dispatch={dispatch} env={{ ...env, ...localEnv}} />,
                    }
                ]
            },
            [],
        )
            .map(line => line.view)
        }
    </React.Fragment>
)


export const SheetLine = ({ line, dispatch, env }) => {
    const onUpdateBlock = update => dispatch(updateLineBlock, line.id, update)
    return (
        <SheetLineContainer key={line.id}>
            <SheetUIToggles line={line} dispatch={dispatch} />
            <SheetLineContent>
                <AssignmentLine line={line} dispatch={dispatch} />
                {line.block.render(onUpdateBlock, env)}
            </SheetLineContent>
        </SheetLineContainer>
    )
}


export const AssignmentLine = ({ line, dispatch }) => {
    const onUpdateName = name => dispatch(setName, line.id, name)
    return (
        <div className="self-stretch pr-2 -mb-1 text-slate-500 font-light text-xs">
            <VarNameInput
                value={line.name}
                onUpdate={onUpdateName}
                placeholder={lineDefaultName(line)}
            />
            &nbsp;=
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

const SheetUIToggles = ({ line, dispatch }) => {
    const onInsertBefore = () => dispatch(insertBeforeCode, line.id)
    const onInsertAfter  = () => dispatch(insertAfterCode,  line.id)
    const onDelete       = () => dispatch(deleteCode,       line.id)

    const Button = props => (
        <IconToggleButton className="w-full" isActive={true} {...props} />
    )

    const Menu = () => (
        <PopoverPanelStyled className="absolute -right-1 translate-x-full">
            <Button onUpdate={onInsertBefore} icon={solidIcons.faChevronUp}   label="Insert before" />
            <Button onUpdate={onInsertAfter}  icon={solidIcons.faChevronDown} label="Insert after"  />
            <Button onUpdate={onDelete}       icon={solidIcons.faTrash}       label="Delete"        />
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
