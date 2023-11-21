import * as React from 'react'
import ReactDOM from 'react-dom/client'

import 'prismjs/themes/prism.css'

import { library } from './utils/std-library'
import { DocumentOf, DocumentState } from './blocks/document'
import { BlockSelector, BlockSelectorState } from './blocks/block-selector'
import { Block } from './block/component'
import { getFullKey } from './ui/utils'
import { BlockRef } from './block'


const blocks = library.blocks

type ToplevelBlockState = DocumentState<BlockSelectorState>
const ToplevelBlock = DocumentOf(BlockSelector('', null, blocks))



function App({ initState }: { initState: ToplevelBlockState }) {
    const [toplevelState, setToplevelState] = React.useState<ToplevelBlockState>(initState)
    const toplevelBlockRef = React.useRef<BlockRef>()

    React.useEffect(() => {
        toplevelBlockRef.current?.focus()
        document.addEventListener('keydown', onKeyDown)
        rootElement.addEventListener('focusout', onFocusout)
        const timeout = setInterval(fixFocus, 100)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            rootElement.removeEventListener('focusout', onFocusout)
            clearInterval(timeout)
        }
    }, [])

    // keep the focus on the toplevel block, so its KeyEventHandlers keep working
    function onFocusout(event: FocusEvent) {
        // this could be problematic, but let's wait until problems arise
        if (!(event.relatedTarget instanceof Element) || !rootElement.contains(event.relatedTarget)) {
            toplevelBlockRef.current?.focus()
        }
    }

    function fixFocus() {
        if (rootElement.contains(document.activeElement)) {
            return
        }

        toplevelBlockRef.current?.focus()
    }

    function onKeyDown(event: KeyboardEvent) {
        switch (getFullKey(event)) {
            case 'Enter':
                if (document.activeElement === document.body) {
                    toplevelBlockRef.current?.focus()
                    event.stopPropagation()
                    event.preventDefault()
                }
                return

            case 'Escape':
                // don't exit full-screen in Safari
                //   I hope nobody really wants this. Personally, this annoys me all the time.
                //   So I prevent it until somebody complains.
                event.preventDefault()
                return
        }
    }

    return (
        <Block
            state={toplevelState}
            update={setToplevelState}
            block={ToplevelBlock}
            env={library}
            blockRef={toplevelBlockRef}
            />
    )
}


async function loadInitState() {
    const loadParam = new URLSearchParams(document.location.search).get('load')
    if (loadParam === null) {
        return ToplevelBlock.init
    }

    try {
        const response = await fetch(loadParam)
        const content = await response.json()
        return ToplevelBlock.fromJSON(content, library)
    }
    catch (e) {
        window.alert(`Could not load file from URL: ${e}`)
        return ToplevelBlock.init
    }
}


async function start(root) {
    const initState = await loadInitState()
    root.render(<App initState={initState} />)
}

const rootElement = document.getElementById('app')
const root = ReactDOM.createRoot(rootElement)
start(root)