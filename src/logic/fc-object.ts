import { mapObject } from '../utils'

export const readonlyProps = (values: { [name: string]: any }) => (
    mapObject(values,
        (name, value) => [
            name,
            { value, enumerable: true }
        ]
    )
)

/************ Functional Composable Objects *************/

export type FCO<State = {}, Methods = {}> = State & Methods & FCOPrototype<State, Methods>

interface FCOPrototype<State, Methods> {
    addProps<NewState = {}>(this: FCO<State, Methods>, props: PropertyDescriptorMap): FCO<State & NewState, Methods>
    addState<NewState>(this: FCO<State, Methods>, state: NewState): FCO<State & NewState, Methods>
    addMethods<NewMethods>(this: FCO<State, Methods>, methods: NewMethods): FCO<State, Methods & NewMethods>

    addTag(this: FCO<State, Methods>, tag: symbol): FCO<State, Methods>
    hasTag(this: FCO<State, Methods>, tag: symbol): boolean

    combine<OtherState, OtherMethods>(this: FCO<State, Methods>, other: FCO<OtherState, OtherMethods>): FCO<State & OtherState, Methods & OtherMethods>

    update(this: FCO<State, Methods>, values: Partial<State>): FCO<State, Methods>

    call<Args extends Array<any>, Result>(this: FCO<State, Methods>, method: (this: FCO<State, Methods>, ...args: Args) => Result, ...args: Args): Result
    reduce<Arg>(this: FCO<State, Methods>, method: (this: FCO<State, Methods>, arg: Arg) => FCO<State, Methods>, ...args: Array<Arg>): FCO<State, Methods>
    pipe<Result>(this: FCO<State, Methods>, fn: (arg: FCO<State, Methods>) => Result): Result
}

export const FCOPrototype: FCOPrototype<unknown, unknown> = {
    addProps(props: PropertyDescriptorMap) {
        return Object.create(
            Object.getPrototypeOf(this),
            { ...Object.getOwnPropertyDescriptors(this), ...props },
        )
    },
    addState(state: Object) {
        return this.addProps(readonlyProps(state))
    },
    addMethods(methods: Object) {
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
    addTag(tag: symbol) {
        return Object.create(
            Object.create(FCOPrototype,
                {
                    ...Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this)),
                    [tag]: { value: tag },
                }
            ),
            Object.getOwnPropertyDescriptors(this),
        )
    },
    hasTag(tag: symbol) {
        return this?.[tag] === tag
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

    update(values: Object) {
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
}

export const FCO: FCO =
    Object.create(
        Object.create(FCOPrototype, {}),
        {},
    )
