import * as React from 'react'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Transition } from '@headlessui/react'


export interface ActionToastProps {
    id: number
    show: boolean
    text: string
    undoAction(): void
    removeToast(id: number): void
}

export function ActionToast({ id, show, text, removeToast, undoAction }: ActionToastProps) {
    const [visible, setVisible] = React.useState(true)

    return (
        <Transition
            show={show && visible}
            appear={true}
            enter="transition-[opacity] duration-150"
            enterFrom="opacity-0"
            leave="transition-[opacity,max-height] duration-1000 overflow-y-clip"
            leaveFrom="max-h-24"
            leaveTo="opacity-0 max-h-0"
            afterLeave={() => removeToast(id)}
        >
            <div
                className={`
                    relative flex flex-row max-w-48 cursor-default
                    rounded overflow-clip my-1 bg-gray-200 shadow
                    opacity-70 hover:opacity-100
                    text-xs text-gray-500 hover:text-gray-800
                `}
            >
                <Transition
                    appear={true}
                    className="absolute left-0 top-0 h-1 bg-gray-400/20"
                    enter="transition-[width] ease-linear duration-[10000ms]"
                    enterFrom="w-0"
                    enterTo="w-full"
                    entered="w-full"
                    afterEnter={() => setVisible(false)}
                    />

                <span className="flex-1 text-ellipsis mx-2 my-1">{text}</span>
                <button
                    className="w-5 hover:bg-gray-300"
                    onClick={() => { visible && undoAction(); setVisible(false) }}
                >
                    <FontAwesomeIcon icon={solidIcons.faArrowRotateLeft} />
                </button>
            </div>
        </Transition>
    )
}


export function useActionToast<State>(
    undoState: (oldState: State, description: string) => void,
): [React.ReactNode, (description: string, state: State) => void] {
    const [toasts, setToasts] = React.useState<{ id: number, description: string, undo: State }[]>([])

    const addToast = React.useCallback(function addToast(description: string, state: State) {
        setToasts(current => [
            {
                id: 1 + (current[0]?.id ?? -1),
                description,
                undo: state,
            },
            ...current,
        ])
    }, [setToasts])

    const removeToast = React.useCallback(function removeToast(id: number) {
        setToasts(current => current.filter(toast => toast.id !== id))
    }, [setToasts])

    const ui = (
        <div className="absolute top-2 right-2 flex flex-col items-end">
            {toasts
                .map(({ id, description, undo }, index) => (
                    <ActionToast
                        key={id}
                        id={id}
                        show={index === 0}
                        text={description}
                        undoAction={() => undoState(undo, description)}
                        removeToast={removeToast}
                        />
                ))
                .reverse()
            }
        </div>
    )

    return [ui, addToast]
}
