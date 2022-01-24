import { computeExpr } from './compute'
import { initialBlockState } from './value'


export const mapObject = (obj, fn) => (
    Object.fromEntries(
        Object.entries(obj)
            .map(entry => fn(...entry))
    )
)

export const filterEntries = (predicate, obj) => (
    Object.fromEntries(
        Object.entries(obj)
            .filter(([ name, value ]) => predicate(name, value))
    )
)

export const readonlyProps = values => (
    mapObject(values,
        (name, value) => [
            name,
            { value, enumerable: true }
        ]
    )
)

export const Component = (props, methods={}) => Object.create(methods, readonlyProps(props))

export const combineComponents = (firstComponent, secondComponent) => Object.create(
    {
        ...Object.getPrototypeOf(firstComponent),
        ...Object.getPrototypeOf(secondComponent),
    },
    {
        ...Object.getOwnPropertyDescriptors(firstComponent),
        ...Object.getOwnPropertyDescriptors(secondComponent),
    },
)

export const extendComponent = (component, extender) => (
    combineComponents(component, extender(component))
)

export const ExtendedComponent = (component, ...extenders) =>
    extenders.reduce(extendComponent, component)


export const CombinedComponent = (...components) =>
    components.reduce(combineComponents)



export const UpdateComponent = Component({}, {
    update(newValues) {
        return Object.create(
            Object.getPrototypeOf(this),
            mapObject(
                Object.getOwnPropertyDescriptors(this),
                (name, descriptor) => [
                    name,
                    {
                        ...descriptor,
                        value:
                            name in newValues ?
                                newValues[name]
                            :
                                descriptor.value,
                    }
                ]
            )
        )
    },
})



export const UtilsComponent = Component({}, {
    applyWhen(cond, fn) {
        if (cond) {
            return fn(this)
        }
        else {
            return this
        }
    },
    call(method, ...args) {
        return method.apply(this, args)
    },
    mapFields(mappers) {
        const newValues =
            mapObject(mappers,
                (name, fn) => [
                    name,
                    fn(this[name])
                ]
            )
        return this.update(newValues)
    }
})


export const SaveLoadNothingComponent = Component({}, {
    save() {
        return {}
    },

    load(obj) {
        if (Object.keys(obj).length > 0) {
            console.warn('stray content after load:', obj)
        }
        return this
    }
})

export const SaveLoadSimpleExtension = (...propNameList) => ante => Component({}, {
    save() {
        const saved = this.call(ante.save)
        const ownSave = filterEntries(name => propNameList.includes(name), this)
        return { ...saved, ...ownSave }
    },

    load(input) {
        const ownInput = filterEntries(name => propNameList.includes(name), input)
        const anteInput = filterEntries(name => !propNameList.includes(name), input)
        const loaded = this.call(ante.load, anteInput)
        return loaded.update(ownInput)
    },
})


export const SaveLoadJSExprExtension = SaveLoadSimpleExtension('expr')


export const JSExprComponent = Component(
    {
        expr: "",
    },
    {
        exec(env) {
            return computeExpr(this.expr, env)
        },
    },
)




export const CachedComputationComponent = Component(
    {
        cachedResult: null,
        invalidated: true,
        autorun: true,
    },
    {
        updateExpr(expr) {
            return this
                .update({ expr })
                .invalidate()
        },
        precompute(env) {
            if (!this.invalidated) { return this }
            return this.update({
                cachedResult: this.exec(env)
            })
        },
        invalidate() {
            if (!this.autorun) { return this }
            return this.update({
                invalidated: true
            })
        },
        forcecompute(env) {
            return this.update({
                cachedResult: this.exec(env)
            })
        },
    }
)



export const SaveLoadEnvironmentExtension = ante => Component({}, {
    load({ id, name, prev, ...input }) {
        const loaded = this.call(ante.load, input)
        const prevLoaded = prev && this.load(prev)
        return loaded.update({ id, name, prev: prevLoaded })
    },

    save() {
        const saved = this.call(ante.save)
        const prev = this.prev?.save() || null
        const { id, name } = this
        return { ...saved, id, name, prev }
    },
})

export const EnvironmentComponent = Component(
    {
        id: 0,
        name: "",
        prev: null,
    },
    {
        getDefaultName() {
            return '$' + this.id
        },
        getName() {
            return this.name.length > 0 ? this.name : this.getDefaultName()
        },
        getNextFreeId(candidate = 0) {
            const freeCandidate = candidate <= this.id ? this.id + 1 : candidate
            return this.prev ? this.prev.getNextFreeId(freeCandidate) : freeCandidate
        },

        reindex(codeNotToClashWith) {
            const prev = this.prev?.reindex(codeNotToClashWith)
            const id = codeNotToClashWith.getNextFreeId(prev ? prev.id + 1 : 0)
            return this.update({ id, prev })
        },
        append(prev) {
            if (this.prev) {
                return this.update({ prev: this.prev.append(prev) })
            }
            else {
                return this.update({ prev })
            }
        },

        getWithId(id) {
            if (this.id === id) {
                return this
            }
            else {
                return this.prev?.getWithId(id)
            }
        },
        mapWithId(id, fn) {
            if (this.id === id) {
                return fn(this)
            }
            else {
                return this.update({
                    prev: this.prev?.mapWithId(id, fn)
                })
            }
        },
        toList() {
            if (!this.prev) { return [this] }
            return [ this, ...this.prev.toList() ]
        },
        fromList(list) {
            return list.reduceRight(
                (prev, code) => code.update({ prev }),
                null,
            )
        },
    }
)



export const CachedEnvironmentComponent = Component({}, {
    precomputeAll(globalEnv) {
        const prev = this.prev?.precomputeAll(globalEnv)
        const env = prev ? prev.toEnv() : {}
        return this
            .precompute({ ...globalEnv, ...env })
            .update({ prev })
    },
    forcecomputeAll(globalEnv) {
        const prev = this.prev?.forcecomputeAll(globalEnv)
        const env = prev ? prev.toEnv() : {}
        return this
            .forcecompute({ ...globalEnv, ...env })
            .update({ prev })
    },

    updateExprWithId(id, expr) {
        return this
            .mapWithId(id, code => code.update({ expr }))
            .invalidateWithId(id)
    },
    invalidateWithId(id) {
        if (this.id === id) {
            return this.invalidate()
        }
        else {
            return this
                .update({
                    prev: this.prev.invalidateWithId(id)
                })
                .invalidate()
        }
    },

    toEnv() {
        return Object.fromEntries(
            this.toList()
                .map(code => [ code.getName(), code.cachedResult ])
        )
    },
})



export const USAGE_MODES = [ 'use-result', 'use-data' ]

export const SaveLoadBlockExtension = SaveLoadSimpleExtension('state')

export const BlockComponent = Component({
    state: initialBlockState,
    usageMode: USAGE_MODES[0],
})



export const defaultCodeUI = {
    isNameVisible: true,
    isCodeVisible: true,
    isResultVisible: true,
    isStateVisible: false,
}

export const CodeUIOptionsComponent = Component({
    ui: defaultCodeUI,
})


export const CodeBlock = CombinedComponent(
    UpdateComponent,
    UtilsComponent,
    JSExprComponent,
    CachedComputationComponent,
    EnvironmentComponent,
    ExtendedComponent(
        SaveLoadNothingComponent,
        SaveLoadJSExprExtension,
        SaveLoadEnvironmentExtension,
        SaveLoadBlockExtension,
    ),
    CachedEnvironmentComponent,
    BlockComponent,
    CodeUIOptionsComponent,
)


export const CommandBlock = CombinedComponent(
    UpdateComponent,
    UtilsComponent,
    JSExprComponent,
    CachedComputationComponent,
    Component({ blockState: initialBlockState }),
    ExtendedComponent(
        SaveLoadNothingComponent,
        SaveLoadJSExprExtension,
        SaveLoadSimpleExtension('blockState'),
    )
)
