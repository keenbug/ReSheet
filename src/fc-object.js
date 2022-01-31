import { mapObject } from './utils'

export const readonlyProps = values => (
    mapObject(values,
        (name, value) => [
            name,
            { value, enumerable: true }
        ]
    )
)

/************ Functional Composable Objects *************/

export const FCOPrototype = {
    addProps(props) {
        return Object.create(
            Object.getPrototypeOf(this),
            { ...Object.getOwnPropertyDescriptors(this), ...props },
        )
    },
    addState(state) {
        return this.addProps(readonlyProps(state))
    },
    addMethods(methods) {
        return Object.create(
            Object.create(FCOPrototype,
                {
                    ...Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this)),
                    ...readonlyProps(methods),
                }
            ),
            Object.getOwnPropertyDescriptors(this),
        )
    },

    combine(other) {
        return Object.create(
            Object.create(FCOPrototype,
                {
                    ...Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this)),
                    ...Object.getOwnPropertyDescriptors(Object.getPrototypeOf(other)),
                }
            ),
            {
                ...Object.getOwnPropertyDescriptors(this),
                ...Object.getOwnPropertyDescriptors(other),
            },
        )
    },

    update(values) {
        return Object.create(
            Object.getPrototypeOf(this),
            mapObject(
                Object.getOwnPropertyDescriptors(this),
                (name, descriptor) => [
                    name,
                    name in values ?
                        { ...descriptor, value: values[name] }
                    :
                        descriptor
                    ,
                ],
            )
        )
    },
    call(method, ...args) {
        return method.apply(this, args)
    },
    reduce(method, ...args) {
        return args.reduce(
            (obj, arg) => obj.call(method, arg),
            this
        )
    },
    pipe(fn) {
        return fn(this)
    },
    pipeWhen(condition, fn) {
        if (condition(this)) {
            return fn(this)
        }
        else {
            return this
        }
    }
}

export const FCO =
    Object.create(
        Object.create(FCOPrototype, {}),
        {},
    )
