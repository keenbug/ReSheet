import * as React from 'react'
import { Popover } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { IconToggleButton, TextInput, classed } from '../ui/utils'
import { FCO } from '../logic/fc-object'
import { fcoBlockAdapter } from '../logic/components'


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
    block.update({ lines: updateLineWithId(id, line => ({ ...line, state: update(line.state) }), block.lines) })

export const setName = (id, name, block) =>
    block.update({ lines: updateLineWithId(id, line => ({ ...line, name }), block.lines) })

export const insertBeforeCode = (id, block) =>
    block.update({ lines: insertLineBefore(id, { id: nextFreeId(block.lines), name: '', state: block.innerBlock.init }, block.lines) })

export const insertAfterCode = (id, block) =>
    block.update({ lines: insertLineAfter(id, { id: nextFreeId(block.lines), name: '', state: block.innerBlock.init }, block.lines) })

export const deleteCode = (id, block) =>
    block.lines.length > 1 ?
        block.update({ lines: block.lines.filter(line => line.id !== id) })
    :
        block




/**************** UI *****************/


const SheetLineContainer = classed<any>('div')`flex flex-row space-x-2`
const SheetLineContent = classed<any>('div')`flex flex-col space-y-1 flex-1`

const VarNameInput = classed<any>(TextInput)`
    hover:bg-gray-200 hover:text-slate-700
    focus:bg-gray-200 focus:text-slate-700
    outline-none
    p-0.5 -ml-0.5
    rounded
`


export const SheetBlockFCO = innerBlock => FCO
    .addState({
        innerBlock,
        lines: [{ id: 0, name: '', state: innerBlock.init }],
    })
    .addMethods({
        fromJSON(json, env) {
            return this.update({
                lines: json
                    .reduce(
                        (prevLines, { id, name, state}) => {
                            const localEnv = { ...env, ...resultLinesToEnv(prevLines) }
                            const loadedState = this.innerBlock.fromJSON(state, localEnv)
                            const result = this.innerBlock.getResult(loadedState, localEnv)
                            return [
                                ...prevLines,
                                { id, name, state: loadedState, result }
                            ]
                        },
                        []
                    )
                    .map(({ id, name, state }) => ({ id, name, state }))
            })
        },
        toJSON() {
            return this.lines.map(({ id, name, state }) => ({ id, name, state: this.innerBlock.toJSON(state) }))
        },
        view({ block, setBlock, env }) {
            const dispatch = (action, ...args) => {
                setBlock(self => action(...args, self))
            }
            return <Sheet block={block} dispatch={dispatch} env={env} />
        },
        getResultLines(env) {
            return this.lines.reduce(
                (previousResultLines, { id, name, state }) =>
                    [
                        ...previousResultLines,
                        {
                            id, name,
                            result: this.innerBlock.getResult(state, {
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
            return resultLines[resultLines.length - 1].result
        },
    })

export const SheetBlock = innerBlock => fcoBlockAdapter(SheetBlockFCO(innerBlock))

export const Sheet = ({ block, dispatch, env }) => (
    <React.Fragment>
        {block.lines.reduce(
            (previousLines, line) => {
                const { id, name, state } = line
                const localEnv = resultLinesToEnv(previousLines)
                return [
                    ...previousLines,
                    {
                        id, name,
                        result: block.innerBlock.getResult(state, { ...env, ...localEnv }),
                        view: <SheetLine key={id} block={block.innerBlock} line={line} dispatch={dispatch} env={{ ...env, ...localEnv}} />,
                    }
                ]
            },
            [],
        )
            .map(line => line.view)
        }
    </React.Fragment>
)


export const SheetLine = ({ block, line, dispatch, env }) => {
    const onUpdateBlock = update => dispatch(updateLineBlock, line.id, update)
    return (
        <SheetLineContainer key={line.id}>
            <SheetUIToggles line={line} dispatch={dispatch} />
            <SheetLineContent>
                <AssignmentLine line={line} dispatch={dispatch} />
                {block.view({ state: line.state, setState: onUpdateBlock, env })}
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

const PopoverPanelStyled = classed<any>(Popover.Panel)`
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
