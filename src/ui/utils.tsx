import * as React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styled, { css } from 'styled-components'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { interpolate } from '../utils'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'


// Fulfilled by both React.KeyboardEvent and the DOM's KeyboardEvent
interface KeyboardEvent {
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    altKey: boolean
    key: string
}

// Keys that don't change with shift on all keyboard layouts (except for maybe uppercase/lowercase)
export const shiftStableKeys = [
    "[A-Z]",
    " ",
    "Tab",
    "Enter",
    "Backspace",
    "Delete",
    "Escape",
    "Arrow(Up|Down|Left|Right)",
    "Home",
    "End",
    "Page(Up|Down)",
]
export const shiftStableKeysRegex = new RegExp("^(" + shiftStableKeys.join('|') + ")$")

export function getFullKey(event: KeyboardEvent) {
    const keyName = event.key.length > 1 ? event.key : event.key.toUpperCase()
    const shiftStable = shiftStableKeysRegex.test(keyName)
    return [
        (event.ctrlKey || event.metaKey) ? "C-" : "",
        shiftStable && event.shiftKey ? "Shift-" : "",
        event.altKey ? "Alt-" : "",
        keyName,
    ].join('')
}


type ClassedElemType<P> = React.FunctionComponent<P> | React.ComponentClass<P> | string

export const classed = <P extends { className?: string }>(
    elem: ClassedElemType<P>
) => (strings: TemplateStringsArray, ...interpolations: Array<any>) =>
    React.forwardRef<unknown, P>((props, ref) =>
        React.createElement(
            elem,
            {
                ...props,
                ref,
                className: `${interpolate(strings, interpolations, props)} ${props.className ?? ""}`,
            }
        )
    )


export function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
    if (!element) { return null }

    const isScrollable = element.scrollHeight > element.clientHeight
    if (isScrollable) { return element }

    return findScrollableAncestor(element.parentElement)
}


const textInputChildStyle: React.CSSProperties = {
    margin: "0px",
    border: "0px",
    background: "none",
    boxSizing: "inherit",
    display: "inherit",
    fontFamily: "inherit",
    fontSize: "inherit",
    fontStyle: "inherit",
    fontVariantLigatures: "inherit",
    fontWeight: "inherit",
    letterSpacing: "inherit",
    lineHeight: "inherit",
    tabSize: "inherit",
    textIndent: "inherit",
    textRendering: "inherit",
    textTransform: "inherit",
    whiteSpace: "pre-wrap",
    wordBreak: "keep-all",
    overflowWrap: "break-word",
    padding: "0px",
    paddingInline: '2px',
  }

export const TextInput: React.FC<any> = React.forwardRef(
    function TextInput({ value, onUpdate, placeholder, ...props }, ref: React.Ref<HTMLInputElement>) {
        function onChange(event: React.ChangeEvent<HTMLInputElement>) {
            onUpdate(event.target.value)
        }
        return (
            <div
                style={{
                    display: "inline-block",
                    position: "relative",
                    textAlign: "left",
                    boxSizing: "border-box",
                    padding: "0px",
                }}
                {...props}
                >
                <input
                    ref={ref}
                    type="text"
                    placeholder={placeholder}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    data-gramm="false"
                    onChange={onChange}
                    style={{
                        ...textInputChildStyle,
                        position: "absolute",
                        inset: "0px",
                        resize: "none",
                        color: "inherit",
                    }}
                    value={value}
                    />
                <div
                    aria-hidden="true"
                    style={{
                        ...textInputChildStyle,
                        position: "relative",
                        pointerEvents: "none",
                        color: "transparent",
                    }}
                    >
                    {value || placeholder}
                </div>
            </div>
        )
    }
)


const ErrorViewContainer = classed<any>('div')`
    rounded
    flex flex-col
    space-y-1 mx-1 p-2
    bg-red-50
`

const ErrorTitle = classed<any>('h1')`
    font-medium
`
const ErrorName = classed<any>('h2')`
    text-red-900
`
const ErrorMessageButton = classed<any>('button')`
    text-left text-sm flex items-center
`
const ErrorStack = classed<any>('pre')`
    ml-3
    text-sm leading-loose
`

interface ErrorViewProps {
    title: string
    error: Error
    children: any
    className?: string
}

export function ErrorView({ title, error, children, className }: ErrorViewProps) {
    const [isExpanded, setIsExpanded] = React.useState<boolean>(false)
    const toggleExpanded = () => setIsExpanded(isExpanded => !isExpanded)

    return (
        <ErrorViewContainer className={className}>
            <ErrorTitle>{title}</ErrorTitle>
            <ErrorName>{error.name}</ErrorName>
            <ErrorMessageButton onClick={toggleExpanded}>
                <FontAwesomeIcon className="mr-2" icon={isExpanded ? solidIcons.faAngleDown : solidIcons.faAngleRight} />
                {error.message}
            </ErrorMessageButton>
            {isExpanded && <ErrorStack>{error.stack}</ErrorStack>}
            {children}
        </ErrorViewContainer>
    )
}


export const Button = classed<any>('button')`
    text-left
    text-slate-800

    hover:bg-gray-200
    focus:bg-gray-300

    transition-colors

    outline-none
    h-7 px-1 space-x-1
`

export const IconToggleButton: React.FC<any> = ({ className, isActive, icon, iconDisabled, onUpdate, label="", ...props }) => (
    <Button
        className={(className ?? "") + (isActive ? "" : " text-slate-400")}
        onClick={onUpdate}
        {...props}
    >
        <IconForButton icon={isActive ? icon : (iconDisabled || icon)} />
        {label && <span>{label}</span>}
    </Button>
)

export const IconForButton: React.FC<{ icon: IconDefinition }> = ({ icon }) => (
    <div className="inline-block w-5 text-center">
        <FontAwesomeIcon size="xs" icon={icon} />
    </div>
)


export function selectFile(): Promise<File> {
    return new Promise(resolve => {
        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.onchange = () => {
            resolve(fileInput.files[0])
            fileInput.remove()
        }
        fileInput.click()
    })
}


export interface LoadFileButtonProps extends Omit<React.LabelHTMLAttributes<HTMLButtonElement>, 'onLoad'> {
    onLoad: (file: File) => void
}

export const LoadFileButton = React.forwardRef(
    function LoadFileButton(
        { onLoad, children, ...props }: LoadFileButtonProps,
        ref: React.Ref<HTMLButtonElement>
    ) {
        async function loadFile(event) {
            onLoad(await selectFile())

            // Workaround for headlessui Menu.Item:
            //  Menu.Item seems to inject an onClick handler, which closes the menu.
            //  If the menu is closed, this fileInput doesn't work anymore, so we defer
            //  the handler until the File Dialog is closed.
            props.onClick?.(event)
        }

        return (
            <button ref={ref} {...props} onClick={loadFile}>
                {children}
            </button>
        )
    }
)


export const SaveFileButton: React.FC<any> = ({ mimeType, textContent, filename, children, ...props }) => {
    const dataStr = `data:${mimeType};charset=utf-8,${encodeURIComponent(textContent)}`

    return (
        <a href={dataStr} download={filename} {...props}>
            {children}
        </a>
    )
}

export function saveFile(filename: string, mimeType: string, textContent: string) {
    const blob = new Blob([textContent], { type: mimeType })
    const downloadButton = document.createElement('a')
    downloadButton.href = URL.createObjectURL(blob)
    downloadButton.download = filename
    downloadButton.click()
    downloadButton.remove()
}