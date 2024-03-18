import * as block from '@resheet/core/block'
import { Block, Environment } from '@resheet/core/block'

import { addRevision, addValidator } from '@resheet/util/serialize'
import { boolean, array, number, any, string, lazy } from '@resheet/util/validate'

import { typed, typedTables } from '.'
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


function parsePage<Inner>(
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
    const pageEnv = getSiblingsEnv(children, env)
    const loadedState = innerBlock.fromJSON(state, localDispatch, pageEnv)
    const page: PageState<Inner> = {
        id,
        name,
        state: loadedState,
        isCollapsed,
        children: loadedChildren,
    }
    return page

    function getSiblingsEnv(siblings: PageState<Inner>[], env: Environment) {
        return Object.assign(
            {},
            env,
            ...siblings.map(sibling => ({
                [getName(sibling)]: innerBlock.getResult(sibling.state)
            }))
        )
    }
}


function parseSiblingPages<Inner>(
    json: any[],
    updatePageStateAt: (path: PageId[], action: block.BlockAction<Inner>) => void,
    env: Environment,
    innerBlock: Block<Inner>,
    path: PageId[]
): PageState<Inner>[] {
    return block.mapWithEnv(
        json,
        (jsonEntry, localEnv) => {
            const page = parsePage(jsonEntry, updatePageStateAt, localEnv, innerBlock, path)
            return {
                out: page,
                env: { [getName(page)]: innerBlock.getResult(page.state) },
            }
        },
        env,
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

function pageToJSON<Inner>(page: PageState<Inner>, innerBlock: Block<Inner>) {
    return {
        id: page.id,
        name: page.name,
        state: innerBlock.toJSON(page.state),
        isCollapsed: page.isCollapsed,
        children: pagesToJSON(page.children, innerBlock),
    }
}
