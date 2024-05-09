import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import Markdown, { compiler } from 'markdown-to-jsx'

import { mergeDeep } from 'immutable'


export function LinkTooltip({ title, href, children }) {
    return (
        <span className="relative group/mdlink text-blue-800">
            {children}
            <div className="absolute left-0 bottom-0">
                <a
                    href={href}
                    title={title}
                    target="_blank"
                    className={`
                        hidden group-hover/mdlink:block hover:block
                        rounded rounded-tl-none px-1.5 py-0.5 bg-gray-200 text-black text-xs whitespace-nowrap
                        absolute left-0 top-0 z-40
                    `}
                    onMouseDown={ev => ev.preventDefault()}
                >
                    open link <FontAwesomeIcon size="sm" icon={solidIcons.faArrowUpRightFromSquare} />
                </a>
            </div>
        </span>
    )
}

export function LinkCapturing({ title, href, children }) {
    return (
        <a
            href={href}
            title={title}
            target="_blank"
            className="text-blue-800"
            onMouseDown={ev => {
                if (ev.ctrlKey || ev.metaKey) { return }
                ev.preventDefault()
            }}
        >{children}</a>
    )
}



export const overrides = {
    a: LinkCapturing,
}

export function compileMarkdown(content: string) {
    return compiler(content, { overrides })
}

export function EditableMarkdown(props: React.ComponentProps<typeof Markdown>) {
    return (
        <Markdown
            {...props}
            options={mergeDeep({ overrides }, props.options ?? {})}
            />
    )
}