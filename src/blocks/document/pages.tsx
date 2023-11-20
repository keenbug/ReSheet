import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'

import { Block, Environment, mapWithEnv } from '../../block'
import { BlockEntry } from '../../block/multiple'
import * as Multiple from '../../block/multiple'

import { arrayEquals, arrayStartsWith } from '../../utils'
import { getFullKey } from '../../ui/utils'


export type PageId = number

export interface PageState<State> extends BlockEntry<State> {
    id: PageId
    name: string
    state: State
    result: unknown

    isCollapsed: boolean
    children: Array<PageState<State>>
}

export function getPageAt<State>(path: PageId[], pages: Array<PageState<State>>) {
    if (path.length === 0) { return null }

    const page = pages.find(page => page.id === path[0])
    if (page === undefined) { return null }
    if (path.length === 1) { return page }

    return getPageAt(path.slice(1), page.children)
}

export function getPageEnv<State>(
    page: PageState<State>,
    siblings: PageState<State>[],
    env: Environment,
) {
    const siblingsEnv = Multiple.getEntryEnvBefore(siblings, page.id)
    const childrenEnv = Multiple.getResultEnv(page.children)
    
    return { ...env, ...siblingsEnv, ...childrenEnv }
}


export function updatePages<State>(
    currentPath: PageId[],
    pages: Array<PageState<State>>,
    update: (path: PageId[], page: PageState<State>, localEnv: Environment) => PageState<State>,
    innerBlock: Block<State>,
    env: Environment,
) {
    return mapWithEnv(
        pages,
        (page, localEnv) => {
            const pathHere = [...currentPath, page.id]

            const children = updatePages(pathHere, page.children, update, innerBlock, localEnv)
            const localEnvWithChildren = { ...localEnv, ...Multiple.getResultEnv(children) }

            const newPage = update(pathHere, { ...page, children }, localEnvWithChildren)
            const result = innerBlock.getResult(newPage.state, localEnvWithChildren)
            return {
                out: { ...newPage, result },
                env: { [Multiple.entryName(newPage)]: result },
            }
        },
        env,
    )
}

export function toJSON<State>(pages: PageState<State>[], innerBlock: Block<State>) {
    return pages.map(page => ({
        id: page.id,
        name: page.name,
        state: innerBlock.toJSON(page.state),
        result: page.result,
        isCollapsed: page.isCollapsed,
        children: toJSON(page.children, innerBlock),
    }))
}

export function fromJSON<State>(json: any[], env: Environment, innerBlock: Block<State>): Array<PageState<State>> {
    return mapWithEnv(
        json,
        (jsonEntry, localEnv) => {
            const { id, name, state, children, isCollapsed = true } = jsonEntry
            const loadedChildren = fromJSON(children, localEnv, innerBlock)
            const pageEnv = { ...localEnv, ...Multiple.getResultEnv(children) }
            const loadedState = innerBlock.fromJSON(state, pageEnv)
            const result = innerBlock.getResult(loadedState, pageEnv)
            const page: PageState<State> = {
                id,
                name,
                state: loadedState,
                result,
                isCollapsed,
                children: loadedChildren,
            }
            return {
                out: page,
                env: Multiple.entryToEnv(page)
            }
        },
        env,
    )
}







export interface PageActions {
    addPage(path: PageId[]): void
    setPageName(path: PageId[], name: string): void
    openPage(path: PageId[]): void
    toggleCollapsed(path: PageId[]): void
    deletePage(path: PageId[]): void
}

export interface PageEntryProps<State> {
    page: PageState<State>
    path?: PageId[]
    openPage: PageId[]
    actions: PageActions
}

const pageStyle = {
    paddingX: 0.5,
    indentDepth: 0.5,
    indentClass(depth: number) {
        const paddingLeft = pageStyle.paddingX + depth * pageStyle.indentDepth
        return `pl-[${paddingLeft}rem] pr-[${pageStyle.paddingX}]`
    },
}

export function PageEntry<State>({ page, path = [], openPage, actions }: PageEntryProps<State>) {
    const [isNameEditing, setIsNameEditing] = React.useState(false)

    const depth = path.length
    const pathHere = [ ...path, page.id ]

    const pageInOpenPath = arrayStartsWith(pathHere, openPage.slice(0, -1))
    const pageCollapsed = page.isCollapsed && !pageInOpenPath

    const untitledName = 'Untitled ' + page.id

    function onChangeName(event: React.ChangeEvent<HTMLInputElement>) {
        actions.setPageName(pathHere, event.target.value)
    }
    function onInputKeyDown(event: React.KeyboardEvent) {
        if (getFullKey(event) === 'Enter') {
            onCommitName()
            event.stopPropagation()
            event.preventDefault()
        }
    }
    function onCommitName() {
        if (page.name.trim() === '') {
            actions.setPageName(pathHere, untitledName)
        }
        else if (page.name !== page.name.trim()) {
            actions.setPageName(pathHere, page.name.trim())
        }
        setIsNameEditing(false)
    }
    function onAddChild(event: React.MouseEvent) {
        actions.addPage(pathHere)
        event.stopPropagation()
    }
    function onDeleteChild(event: React.MouseEvent) {
        actions.deletePage(pathHere)
        event.stopPropagation()
    }


    return (
        <>
            <div
                className={`
                    ${pageStyle.indentClass(depth)} py-1 text-left group cursor-pointer flex space-x-2
                    ${arrayEquals(pathHere, openPage) && "bg-gray-300"}
                `}
                onClick={() => actions.openPage(pathHere)}
                >
                <button onClick={() => actions.toggleCollapsed(pathHere)}>
                    <FontAwesomeIcon
                        className="text-gray-500"
                        icon={pageCollapsed ? solidIcons.faAngleRight : solidIcons.faAngleDown}
                        />
                </button>

                {isNameEditing ? (
                    <input
                        type="text"
                        autoFocus
                        value={page.name}
                        placeholder={untitledName}
                        onChange={onChangeName}
                        onBlur={onCommitName}
                        onKeyDown={onInputKeyDown}
                        />
                ) : (
                    <>
                        <span onDoubleClick={() => setIsNameEditing(true)}>{page.name}</span>
                        <div className="flex-1" />
                        <button
                            className="hidden group-hover:inline-block text-gray-500 hover:text-blue-500"
                            onClick={onDeleteChild}
                            >
                            <FontAwesomeIcon icon={regularIcons.faTrashCan} />
                        </button>
                        <button
                            className="hidden group-hover:inline-block text-gray-500 hover:text-blue-500"
                            onClick={onAddChild}
                            >
                            <FontAwesomeIcon icon={solidIcons.faPlus} />
                        </button>
                    </>
                )}
            </div>
            {!pageCollapsed && <PageChildren page={page} path={pathHere} actions={actions} openPage={openPage} />}
        </>
    )
}


export function PageChildren<State>({ page, actions, path, openPage }: PageEntryProps<State>) {
    if (page.children.length === 0) {
        const depth = path.length
        return (
            <button
                className={`${pageStyle.indentClass(depth)} py-0.5 w-full text-left text-xs text-gray-400 hover:text-blue-700`}
                onClick={() => actions.addPage(path)}
            >
                <FontAwesomeIcon icon={solidIcons.faPlus} />{' '}
                Add Page
            </button>
        )
    }

    const keyHere = path.join('.')
    return (
        <>
            {page.children.map(child => (
                <PageEntry
                    key={keyHere + '.' + child.id}
                    page={child}
                    path={path}
                    openPage={openPage}
                    actions={actions} />
            ))}
        </>
    )
}
