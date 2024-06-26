import * as block from '@resheet/core/block'
import { Block, Environment } from '@resheet/core/block'

import { addRevision } from '@resheet/util/serialize'
import { boolean, array, number, any, string, lazy } from '@resheet/util/validate'

import { typed } from '.'
import { PageId, PageState, Document, getName } from '../types/0'
import * as v0 from './0'


const pageSchema = {
    id: number,
    name: string,
    state: any,
    children: array(lazy(() => pageSchema)),
    isCollapsed: boolean,
}

const documentSchema = {
    pages: array(pageSchema),
    template: any,
    viewState: {
        sidebarOpen: boolean,
        openPage: array(number),
    },
}


type Parse = <Inner>(args: {
    updatePageStateAt(path: PageId[], action: block.BlockAction<Inner>): void
    env: Environment
    innerBlock: Block<Inner>
}) => Document<Inner>



function parse<Inner>(
    json: any,
    updatePageStateAt: (path: PageId[], action: block.BlockAction<Inner>) => void,
    env: Environment,
    innerBlock: Block<Inner>,
): Document<Inner> {
    const {
        pages,
        template,
        viewState,
    } = json

    const loadedTemplate = parsePage(template, () => {}, env, innerBlock, [])
    const loadedPages = parseSiblingPages(pages, updatePageStateAt, env, innerBlock, [])
    return {
        pages: loadedPages,
        template: loadedTemplate,
        viewState,
    }
}


export function parsePage<Inner>(
    json: any,
    updatePageStateAt: (path: PageId[], action: block.BlockAction<Inner>) => void,
    env: Environment,
    innerBlock: Block<Inner>,
    path: PageId[]
): PageState<Inner> {
    const { id, name, state, children, isCollapsed } = json

    const pathHere = [...path, id]
    function localDispatch(action: block.BlockAction<Inner>) {
        updatePageStateAt(pathHere, action)
    }

    const loadedChildren = parseSiblingPages(children, updatePageStateAt, env, innerBlock, pathHere)
    const pageEnv = { ...env, ...pagesToEnv(loadedChildren, innerBlock) }
    const loadedState = innerBlock.fromJSON(state, localDispatch, pageEnv)
    const page: PageState<Inner> = {
        id,
        name,
        state: loadedState,
        isCollapsed,
        children: loadedChildren,
    }
    return page
}


function parseSiblingPages<Inner>(
    json: any[],
    updatePageStateAt: (path: PageId[], action: block.BlockAction<Inner>) => void,
    env: Environment,
    innerBlock: Block<Inner>,
    path: PageId[]
): PageState<Inner>[] {
    const { pages } = json.reduce(
        ({ pages, localEnv }, jsonEntry) => {
            const page = parsePage(jsonEntry, updatePageStateAt, localEnv, innerBlock, path)
            return {
                pages: [...pages, page],
                localEnv: {
                    ...localEnv,
                    [getName(page)]: innerBlock.getResult(page.state),
                },
            }
        },
        {
            pages: [],
            localEnv: env,
        }
    )
    return pages
}

function pagesToEnv<Inner>(siblings: PageState<Inner>[], innerBlock: Block<Inner>) {
    return Object.assign(
        {},
        ...siblings.map(sibling => ({
            [getName(sibling)]: innerBlock.getResult(sibling.state)
        }))
    )
}


export const fromJSON = addRevision<v0.Parse, Parse>(v0.fromJSON, {
    schema: typed(1, documentSchema),
    parse: json => ({ updatePageStateAt, env, innerBlock }) => {
        return parse(json, updatePageStateAt, env, innerBlock)
    },
    upgrade: before => before,
})

export function toJSON<Inner>(state: Document<Inner>, innerBlock: Block<Inner>) {
    const { viewState } = state
    const template = pageToJSON(state.template, innerBlock)
    const pages = pagesToJSON(state.pages, innerBlock)
    return typed(1, { pages, viewState, template })
}

function pagesToJSON<Inner>(pages: PageState<Inner>[], innerBlock: Block<Inner>) {
    return pages.map(page => pageToJSON(page, innerBlock))
}

export function pageToJSON<Inner>(page: PageState<Inner>, innerBlock: Block<Inner>) {
    return {
        id: page.id,
        name: page.name,
        state: innerBlock.toJSON(page.state),
        isCollapsed: page.isCollapsed,
        children: pagesToJSON(page.children, innerBlock),
    }
}
