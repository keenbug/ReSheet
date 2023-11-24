import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'

import { Block, BlockUpdater, Environment, mapWithEnv } from '../../block'
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

export function getExpandedPaths(pages: PageState<unknown>[], currentPath: PageId[] = []): Array<PageId[]> {
    return pages.flatMap(page => {
        const isInPath = page.id === currentPath[0]
        const childPath = isInPath ? currentPath.slice(1) : []
        const areChildrenVisible = !page.isCollapsed || childPath.length > 0
        const childPaths = (
            areChildrenVisible ?
                getExpandedPaths(page.children, childPath)
            :
                []
        )
        return [
            [page.id],
            ...childPaths.map(path => [page.id, ...path]),
        ]
    })
}

export function getSiblingsOf<State>(
    path: PageId[],
    pages: Array<PageState<State>>
): [ PageState<State>[], PageState<State>[] ] {
    const siblings = (
        path.length <= 1 ?
            pages
        :
            getPageAt(path.slice(0, -1), pages)
                .children
    )

    const selfId = path.slice(-1)[0] ?? -1
    const selfIndex = Math.min(Number.MAX_SAFE_INTEGER, siblings.findIndex(page => page.id === selfId))
    const siblingsBefore = siblings.slice(0, selfIndex)
    const siblingsAfter = siblings.slice(selfIndex + 1)
    
    return [siblingsBefore, siblingsAfter]
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

export function updatePageAt<State>(
    path: PageId[],
    pages: PageState<State>[],
    action: (state: PageState<State>) => PageState<State>,
    env: Environment,
    innerBlock: Block<State>,
) {
    if (path.length === 0) { return pages }

    return (
        updatePages(
            [],
            pages,
            (currentPath, page) => {
                if (arrayEquals(currentPath, path)) {
                    return action(page)
                }
                return page
            },
            innerBlock,
            env,
        )
    )
}


export function toJSON<State>(pages: PageState<State>[], innerBlock: Block<State>) {
    return pages.map(page => ({
        id: page.id,
        name: page.name,
        state: innerBlock.toJSON(page.state),
        isCollapsed: page.isCollapsed,
        children: toJSON(page.children, innerBlock),
    }))
}

export function fromJSON<State>(
    json: any[],
    update: BlockUpdater<PageState<State>[]>,
    env: Environment,
    innerBlock: Block<State>,
    path: PageId[]
): PageState<State>[] {
    return mapWithEnv(
        json,
        (jsonEntry, localEnv) => {
            const { id, name, state, children, isCollapsed = true } = jsonEntry

            const pathHere = [...path, id]
            function localUpdate(action: (state: State) => State) {
                update(pages => updatePageAt(
                    pathHere,
                    pages,
                    (page) => ({ ...page, state: action(page.state) }),
                    localEnv,
                    innerBlock,
                ))
            }

            const loadedChildren = fromJSON(children, update, localEnv, innerBlock, pathHere)
            const pageEnv = { ...localEnv, ...Multiple.getResultEnv(children) }
            const loadedState = innerBlock.fromJSON(state, localUpdate, pageEnv)
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
    isNameEditing: boolean
    setIsNameEditing: (editing: boolean) => void
}

const pageStyle = {
    paddingX: 0.5,
    indentDepth: 0.5,
    indentClass(depth: number) {
        const paddingLeft = pageStyle.paddingX + depth * pageStyle.indentDepth
        return `pl-[${paddingLeft}rem] pr-[${pageStyle.paddingX}rem]`
    },
}

export function PageEntry<State>({
    page,
    path = [],
    openPage,
    actions,
    isNameEditing,
    setIsNameEditing,
}: PageEntryProps<State>) {
    const depth = path.length
    const pathHere = [ ...path, page.id ]

    const pageInOpenPath = arrayStartsWith(pathHere, openPage.slice(0, -1))
    const pageCollapsed = page.isCollapsed && !pageInOpenPath

    const untitledName = 'Untitled_' + page.id

    function onChangeName(event: React.ChangeEvent<HTMLInputElement>) {
        actions.setPageName(pathHere, event.target.value)
    }
    function onInputKeyDown(event: React.KeyboardEvent) {
        switch (getFullKey(event)) {
            case "Enter":
            case "Escape":
                onCommitName()
                event.stopPropagation()
                event.preventDefault()
                return
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
                        className="text-gray-500 w-4"
                        icon={pageCollapsed ? solidIcons.faAngleRight : solidIcons.faAngleDown}
                        />
                </button>

                {isNameEditing && arrayEquals(pathHere, openPage) ? (
                    <input
                        className="flex-1 min-w-0 w-full"
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
            {!pageCollapsed &&
                <PageChildren
                    page={page}
                    path={pathHere}
                    actions={actions}
                    openPage={openPage}
                    isNameEditing={isNameEditing}
                    setIsNameEditing={setIsNameEditing}
                    />
            }
        </>
    )
}


export function PageChildren<State>({ page, actions, path, openPage, ...props }: PageEntryProps<State>) {
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
                    actions={actions}
                    {...props}
                    />
            ))}
        </>
    )
}
