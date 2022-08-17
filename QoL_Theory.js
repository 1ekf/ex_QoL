var id = "eaux_qol";
var name = "QoL Theory";
var description = "A custom theory for finer main theory auto-purchase controls and heuristic-based star/student reallocation";
var authors = "Eaux Tacous#1021";
var version = "2.02";
var permissions = Permissions.PERFORM_GAME_ACTIONS

const MIN_FREQ = 10;

var state, aTheoryState, expState;

var init = () => {

    state = new State();

    ManagementUtils.refresh();

    theory.createCurrency(); // required for graph activation
}

var tick = (elapsedTime, multiplier) => {

    expState.updateHooks[MathExpUtils.MODESET.TICK].forEach(
        el => expState.expMap[el]?.evaluate()
    )

    ActionUtil.theoryHandler(elapsedTime);

    ActionUtil.resetHandler();

    if (state.autoFreq >= MIN_FREQ && game.statistics.tickCount % state.autoFreq == 0) {
        AllocUtils.simpleStar();
        AllocUtils.simpleStudent();
    }

    expState.resetHooks[MathExpUtils.MODESET.TICK].forEach(
        el => expState.expMap[el]?.evaluate()
    )

    theory.invalidatePrimaryEquation(); // TODO move this

}

var get2DGraphValue = () => {
    if (aTheoryState === undefined) return 0;
    const aTheory = game.activeTheory;
    return (aTheory.nextPublicationMultiplier/aTheory.publicationMultiplier).log().toNumber();
}
var getPrimaryEquation = () => {
    if (aTheoryState === undefined) return "Invalid";
    return `\\text{Pub Time:} ${aTheoryState.pubTime.toFixed(2)}`;
}
var getCurrencyBarDelegate = () => {
    
    let reStar = ui.createButton({
        text: "Reallocate ★",
        onClicked: () => AllocUtils.simpleStar()
    });
    let reSigma = ui.createButton({
        text: "Reallocate σ",
        onClicked: () => AllocUtils.simpleStudent()
    });

    let r9toggle = ui.createStackLayout({
        children: [
            ui.createLabel({
                text: "Buy R9?",
                fontSize: 10,
                verticalTextAlignment: TextAlignment.END,
                horizontalTextAlignment: TextAlignment.CENTER,
                textColor: () => {return state.useR9 ? Color.TEXT : Color.DEACTIVATED_UPGRADE}
            }),
            ui.createSwitch({
                onColor: Color.SWITCH_BACKGROUND,
                isToggled: () => state.useR9,
                onTouched: (e) => {if (e.type == TouchType.PRESSED) state.useR9 = !state.useR9}
            })
        ]
    })

    reStar.row = 0;
    reStar.column = 0;
    reSigma.row = 0;
    reSigma.column = 1;
    r9toggle.row = 0;
    r9toggle.column = 2;

    const autoGrid = ui.createGrid({
        columnDefinitions: ["1*", "1*", "50"],
        children: [reStar, reSigma, r9toggle]
    });

    let autoFreqButton = ui.createButton({
        text: () => {
            const f = (state.autoFreq < MIN_FREQ) ? "Never" : `${state.autoFreq} ticks`;
            return "Auto-reallocation frequency: " + f
        },
        onClicked: () => PopupUtils.showAutoFreqPopup()
    });

    const pubRatio = ui.createButton({
        text: () => {
            if (aTheoryState === undefined) return "Error: Invalid Theory";
            const s = (aTheoryState.publicationRatio > 1) ? aTheoryState.publicationRatio.toString() : "Never"
            return "Publication Ratio:\ " + s;
        },
        onClicked: () => {
            if (aTheoryState !== undefined) PopupUtils.showPubRatioPopup(aTheoryState.id);
        },
        isVisible: () => aTheoryState !== undefined
    });


    let theoryButton = ui.createButton({
        text: "Theory Autobuy Menu",
        onClicked: () => {
            if (aTheoryState !== undefined) PopupUtils.showAutoBuyPopup(aTheoryState.id);
        },
        isVisible: () => aTheoryState !== undefined
    });
    let theoryToggle = ui.createStackLayout({
        children: [
            ui.createLabel({
                text: "Use Autobuy?",
                fontSize: 10,
                verticalTextAlignment: TextAlignment.END,
                horizontalTextAlignment: TextAlignment.CENTER,
                textColor: () => aTheoryState !== undefined && aTheoryState.useAutobuy ? Color.TEXT : Color.DEACTIVATED_UPGRADE 
            }),
            ui.createSwitch({
                onColor: Color.SWITCH_BACKGROUND,
                isToggled: () => aTheoryState !== undefined ? aTheoryState.useAutobuy : false,
                onTouched: (e) => {if (e.type == TouchType.PRESSED && aTheoryState !== undefined) {
                    aTheoryState.useAutobuy= !aTheoryState.useAutobuy;
                    ManagementUtils.setupToggles();
                }}
            })
        ],
        isVisible: () => aTheoryState !== undefined
    })

    theoryButton.row = 0;
    theoryButton.column = 0;
    theoryToggle.row = 0;
    theoryToggle.column = 1;
    const theoryGrid = ui.createGrid({
        columnDefinitions: ["1*", "50"],
        children: [theoryButton, theoryToggle]
    });

    let i = 0;
    let vGridColumnDefinitions = [];
    let vGridChildren = [];
    for (const target in MathExpUtils.TARGET_NAME) {
        if (aTheoryState === undefined && target == MathExpUtils.TARGET_NAME.THEORY) continue;
        const button = ui.createButton({
            text: MathExpUtils.TARGET_NAME_STR[target],
            onClicked: () => {
                PopupUtils.showVarPopup(target)
            },
            row: 0,
            column: i++
        });
        vGridColumnDefinitions.push("1*");
        vGridChildren.push(button);
    }
    const variableGrid = ui.createGrid({
        columnDefinitions: vGridColumnDefinitions,
        children: vGridChildren,
        isVisible: () => state.debug,
    })


    i = 0;
    vGridColumnDefinitions = [];
    vGridChildren = [];
    for (const exprmode in PopupUtils.exprLabels) {
        const button = ui.createButton({
            text: PopupUtils.exprLabels[exprmode].s,
            onClicked: () => {
                PopupUtils.showExprPopup(exprmode)
            },
            row: 0,
            column: i++
        });
        vGridColumnDefinitions.push("1*");
        vGridChildren.push(button);
    }
    const exprGrid = ui.createGrid({
        columnDefinitions: vGridColumnDefinitions,
        children: vGridChildren,
        isVisible: () => state.debug,
    })


    const debugLabel = ui.createLabel({
        text: "DEBUG ON",
        isVisible: () => state.debug
    });

    const stack = ui.createStackLayout({
        children: [
            autoGrid, autoFreqButton, pubRatio, theoryGrid, variableGrid, exprGrid,
            debugLabel
        ]
    });
    return stack;
}



const BNtoString = v => {
    const sSign = v.sign < 0 ? "-" : "";
    const sDepth = v.depth ? `e^{${v.depth}}` : "";
    const sExp = v.exponent + (v.depth ? 6 : 0);

    return `${sSign}${sDepth}${sExp}`;
}

class State {
    constructor() {

        this.useR9 = false;
        this.autoFreq = -1;
        this.debug = false;

        this.globalVarOrder = [];
        this.globalVarMap = {};

        this.theoryStates = {};

        Object.values(PopupUtils.exprLabels).forEach(val => {
            const key = val.v;
            this[key] = undefined
        });

        for (const aTheory of game.theories) {
            if (aTheory.id == 8) continue;
            this.theoryStates[aTheory.id] = new TheoryState(aTheory);
        }
    }

    serialize() {

        const serializedGlobalVarMap = Object.entries(this.globalVarMap).reduce(
            (acc, [key, val]) => {
                return {...acc, [key]: val.serialize()};
            },
            {}
        )
        
        const serializedTheoryStates = Object.entries(this.theoryStates).reduce(
            (acc, [key, val]) => {
                return {...acc, [key]: val.serialize()};
            },
            {}
        )

        const target = {
            ...this,
            globalVarMap: serializedGlobalVarMap,
            theoryStates: serializedTheoryStates,
        }

        Object.values(PopupUtils.exprLabels).forEach(val => {
            const key = val.v
            if (this[key] !== undefined) {
                target[key] = this[key].serialize();
            }
        })

        return JSON.stringify(target, customReplacer)
    }

    importSerialization(s) {

        const intermediate = JSON.parse(s, customReviver);

        if (intermediate.globalVarMap !== undefined) {
            intermediate.globalVarMap = Object.entries(intermediate.globalVarMap).reduce(
                (acc, [key, val]) => {
                    return {...acc, [key]: CustomME.deserialize(val)};
                },
                this.globalVarMap
            )
        }

        if (intermediate.theoryStates !== undefined) {
            intermediate.theoryStates = Object.entries(intermediate.theoryStates).reduce(
                (acc, [key, val]) => {
                    if (!(key in this.theoryStates)) return acc;
                    return {...acc, [key]: this.theoryStates[key].importSerialization(val)};
                },
                this.theoryStates
            );
        }

        Object.values(PopupUtils.exprLabels).forEach(val => {
            const key = val.v
            if (key in intermediate) {
                intermediate[key] = CustomME.deserialize(intermediate[key]);
            }
        })

        Object.keys(this).forEach(key => {
            if (key in intermediate) this[key] = intermediate[key];
        })

        return this;

    }

}

class TheoryState {
    constructor(aTheory) {

        this.version = version;

        this.id = aTheory.id;

        this.publicationRatio = -1;
        this.useAutobuy = false;
        this.pubTime = 0;

        this.theoryVarOrder = [];
        this.theoryVarMap = {};

        this.autoBuyModes = {};
        for (const upgrade of aTheory.upgrades) {
            this.autoBuyModes[upgrade.id] ={
                mode: BuyModeUtils.BUY_MODES.never,
                ratio: BigNumber.TEN
            };
        }
    }

    serialize() {
        const serializedTheoryVarMap = Object.entries(this.theoryVarMap).reduce(
            (acc, [key, val]) => {
                return {...acc, [key]: val.serialize()};
            },
            {}
        )
        return JSON.stringify({
            ...this,
            theoryVarMap: serializedTheoryVarMap
        }, customReplacer)
    }

    importSerialization(s) {

        const intermediate = JSON.parse(s, customReviver);

        if (intermediate.theoryVarMap !== undefined) {
            intermediate.theoryVarMap = Object.entries(intermediate.theoryVarMap).reduce(
                (acc, [key, val]) => {
                    return {...acc, [key]: CustomME.deserialize(val)};
                },
                {}
            )
        }
        
        Object.keys(this).forEach(key => {
            if (key in intermediate) this[key] = intermediate[key];
        })

        return this;
    }

}

class MathExpUtils {

    constructor(globalMap, globalOrder, theoryMap, theoryOrder) {

        this.globalMap = globalMap;
        this.theoryMap = theoryMap;
        this.expMap = {
            ...MathExpUtils.internalMap,
            ...globalMap,
            ...theoryMap,
        };

        this.globalOrder = globalOrder;
        this.theoryOrder = theoryOrder;

        this.targetMap = (target) => {
            switch (target) {
                case MathExpUtils.TARGET_NAME.GLOBAL:
                    return globalMap;
                case MathExpUtils.TARGET_NAME.THEORY:
                    return theoryMap;
                default:
                    throw `Unknown target map ${target}`
            }
        }

        this.targetOrder = (target) => {
            switch (target) {
                case MathExpUtils.TARGET_NAME.GLOBAL:
                    return globalOrder;
                case MathExpUtils.TARGET_NAME.THEORY:
                    return theoryOrder;
                default:
                    throw `Unknown target map ${target}`
            }
        }

        this.genHooks()

    }

    genHooks() {
        this.updateHooks = {}
        this.resetHooks = {}
        
        for (let type of [
            {key: 'updateMode', hooks: this.updateHooks},
            {key: 'resetMode', hooks: this.resetHooks}
        ]) {
            for (let mode in MathExpUtils.MODESET) {
                type.hooks[mode] = []
            }

            for (let order of [this.globalOrder, this.theoryOrder]) {
                order.forEach(
                    name => {
                        const exp = this.expMap[name]
                        if (exp[type.key] in MathExpUtils.MODESET) {
                            type.hooks[exp[type.key]].push(name)
                        } else {
                            throw `Unknown mode ${exp[type.key]}`
                        }
                    }
                )
                
            }
        }
    }

    addVar(target, name, index, obj) {

        const {str, init, updateMode, resetMode} = obj;

        const targetMap = this.targetMap(target);
        const targetOrder = this.targetOrder(target)
        
        if (name in this.expMap) throw `Failed to create var ${name}: already exists`;

        let el = CustomME.create(str, init);
        el.initialize();
        el.updateMode = updateMode;
        el.resetMode = resetMode;

        targetMap[name] = el;
        this.expMap[name] = el;

        if (index === undefined) {
            targetOrder.push(name);
        } else {
            targetOrder.splice(index, 0, name);
        }

        this.genHooks();
    }

    editVar(target, name, index, newname, el, newobj, reinit) {

        if (newname != name) {
            if (newname in this.expMap) throw `Failed to create var ${name}: already exists`;

            const targetMap = this.targetMap(target);
            const targetOrder = this.targetOrder(target);

            targetMap[newname] = targetMap[name];
            delete targetMap[name];
            this.expMap[newname] = this.expMap[name];
            delete this.expMap[name];
            targetOrder[index] = newname;
        }

        el.update(newobj);

        this.genHooks();

        if (reinit) el.initialize();

    }

    delVar(target, name, index) {

        const targetMap = this.targetMap(target);
        const targetOrder = this.targetOrder(target);

        if (!(name in targetMap)) throw `Failed to delete var ${name}: does not exist in ${target}`

        delete targetMap[name];
        delete this.expMap[name];

        if (index === undefined) {
            index = targetOrder.indexOf(name);
            if (index < 0) throw "index not found";
        }
        
        targetOrder.splice(index, 1);

        this.genHooks();
    }

    moveUpVar(target, index) {
        const targetOrder = this.targetOrder(target);
        if (index == 0) return;

        const temp = targetOrder[index - 1];
        targetOrder[index - 1] = targetOrder[index];
        targetOrder[index] = temp;
        this.genHooks();
    }

    moveDownVar(target, index) {
        const targetOrder = this.targetOrder(target);
        if (index == targetOrder.length - 1) return;

        const temp = targetOrder[index + 1];
        targetOrder[index + 1] = targetOrder[index];
        targetOrder[index] = temp;
        this.genHooks();
    }

    moveAnyVar(target, srcindex, destindex) {

        const targetOrder = this.targetOrder(target);

        const temp = targetOrder[srcindex];
        targetOrder.splice(srcindex, 1);
        targetOrder.splice(destindex, 0, temp);
        this.genHooks();
    }

    replacer(s) {
        const targ = new RegExp('\\b(?:' + Object.keys(this.expMap).join('|') + ')\\b', 'g')

        return s.replace(targ, a => {
            if (this.expMap[a] === undefined) throw 'Key not found';
            if (this.expMap[a].valueString === undefined) throw 'Unevaluated';
            return `(${this.expMap[a].valueString})`;
        });
    }
}
MathExpUtils.TARGET_NAME = {
    GLOBAL: 'GLOBAL',
    THEORY: 'THEORY',
}
MathExpUtils.MODESET = {
    NONE: 'NONE',
    TICK: 'TICK',
    PRESTIGE: 'PRESTIGE',
    SUPREMACY: 'SUPREMACY',
    GRADUATION: 'GRADUATION',
    PUBLISH: 'PUBLISH',
}
MathExpUtils.TARGET_NAME_STR = {
    GLOBAL: 'Global Variable',
    THEORY: 'Theory Variable',
}
MathExpUtils.MODESET_STR = {
    NONE: 'never',
    TICK: 'every tick',
    PRESTIGE: 'every prestige',
    SUPREMACY: 'every supremacy',
    GRADUATION: 'every graduation',
    PUBLISH: 'every publication',
}
MathExpUtils.internalMap = {}
function makeInternalVar(name, getter) {
    MathExpUtils.internalMap[name] = {
        get value() {
            return getter();
        },
        get valueString() {
            const val = this.value;
            if (val instanceof BigNumber) return BNtoString(val);
            return "" + val;
        }
    }
}
makeInternalVar('pubt', () => (aTheoryState !== undefined) ? aTheoryState.pubTime : 0);
makeInternalVar('pubr', () => {
    if (aTheoryState === undefined) return -1;
    const aTheory = game.activeTheory;
    return aTheory.nextPublicationMultiplier / aTheory.publicationMultiplier;
})

class CustomME {
    constructor() {}

    static create(str, init) {

        const template = {
            str: str,
            init: init
        }

        return Object.assign(new CustomME(), template);

    }

    initialize(replacer) {

        delete this.me;
        delete this.value;
        delete this.valueString;

        if (this.init !== undefined) {

            replacer = replacer ?? (s => expState.replacer(s));

            let s;
            try {
                s = replacer(this.init);
            } catch (e) {
                if (e == 'Unevaluated') return;
                throw e;
            }
            const initME = MathExpression.parse(s);
            const v = initME.evaluate();
            if (v == null) {
                // if (initME.isErrorCritical) throw initME.error;
                return;
            }
            this.value = v;
            this.valueString = BNtoString(v);
        }
    }

    evaluate(replacer) {

        replacer = replacer ?? (s => expState.replacer(s))

        let s;
        try {
            s = replacer(this.str);
        } catch (e) {
            if (e == 'Unevaluated') return;
            throw e;
        }

        this.updateME(s);
        const v = this.me.evaluate();

        if (v == null) {
            // if (this.me.isErrorCritical) throw initME.error;
            return;
        }

        this.value = v;
        this.valueString = BNtoString(v);

    }

    update(newObj) {
        Object.assign(this, newObj);
    }

    updateME(s) {
        if (this.me === undefined) {
            this.me = MathExpression.parse(s);
            return;
        }
        
        let dme = JSON.parse(Base64.decode(this.me.serialize()));
        dme["Expression"] = '"' + s + '"';
        const st = Base64.encode(JSON.stringify(dme));
        this.me = MathExpression.deserialize(st);
    }

    serialize() {
        if (this.me === undefined) return JSON.stringify(this, customReplacer);

        return JSON.stringify({
            ...this,
            me: this.me.serialize()
        }, customReplacer);
    }

    static deserialize(s) {

        const intermediate = JSON.parse(s, customReviver);

        if (intermediate.me !== undefined) {
            intermediate.me = MathExpression.deserialize(intermediate.me);
        }

        return Object.assign(new CustomME(), intermediate);
    }
}

// Callbacks, toggle setups
class ManagementUtils {

    static refresh() {
        state.version = version;
        this.updateATheoryState();

        this.setupToggles();
        this.setupATheoryCallbacks();
        this.setupExpStateCallbacks();
        this.setupVars()
    }

    static updateATheoryState() {
        const aTheory = game.activeTheory;
        if (aTheory == null || aTheory.id == 8) {
            aTheoryState = undefined;
        } else {
            aTheoryState = state.theoryStates[aTheory.id];
        }
    }

    static setupToggles() {
        if (aTheoryState && aTheoryState.useAutobuy) game.activeTheory.isAutoBuyerActive = false;
    }

    static setupATheoryCallbacks() {
        if (aTheoryState === undefined) return;

        const aTheory = game.activeTheory;
        aTheory.publishing = () => {
            aTheoryState.pubTime = 0;
        }
    }

    static setupExpStateCallbacks() {

        const prefixes = {
            pre: {hook: 'updateHooks', action: 'evaluate'},
            post: {hook: 'resetHooks', action: 'initialize'}
        }

        const actions = {
            Prestige: 'PRESTIGE',
            Supremacy: 'SUPREMACY',
            Graduation: 'GRADUATION'
        }

        Object.entries(prefixes).forEach(
            ([prefix, set]) => {
                Object.entries(actions).forEach(
                    ([action, name]) => {
                        game[prefix + action] = () => {
                            expState[set.hook][MathExpUtils.MODESET[name]].forEach(
                                el => expState.expMap[el]?.[set.action]()
                            )
                        }
                    }
                )
            }
        )

        if (aTheoryState !== undefined) {
            game.activeTheory.publishing = () => {
                expState.updateHooks[MathExpUtils.MODESET.PUBLISH].forEach(
                    el => expState.expMap[el]?.evaluate()
                )
            }

            game.activeTheory.published = () => {
                expState.resetHooks[MathExpUtils.MODESET.PUBLISH].forEach(
                    el => expState.expMap[el]?.initalize()
                )
            }
        }

        // TICK is managed in tick()

    }

    static setupVars() {

        expState = new MathExpUtils(
            state.globalVarMap,
            state.globalVarOrder,
            aTheoryState?.theoryVarMap ?? {},
            aTheoryState?.theoryVarOrder ?? {}
        )
    }

}
game.activeTheoryChanged = () => {
    ManagementUtils.refresh();
}

class AllocUtils {

    static simpleStar() {

        const starUps = Array.from(game.starBonuses).filter(x => x.id >= 4000 && x.id < 5000 && x.isAvailable);
        const variables = Array.from(game.variables).filter(x => x.id > 0 && x.isAvailable);

        starUps.forEach(x => x.refund(-1));

        const len = Math.min(starUps.length, variables.length);

        let doubleUps = new Set(Array(len).keys());
        let singleUps = new Set();

        const dThreshold = 0.00001; // 0.001%
        const sThreshold = dThreshold / 100;
        const trivialStars = 0.001 * game.starsTotal;
        const MAX_ITER = 100;

        for (let k = 0; k < MAX_ITER; k++) {

            let toMove = [];
            let toDelete = [];

            let best = null;
            let best2 = null;

            for (const i of doubleUps) {

                const up = starUps[i];

                up.buy(-1);
                const maxLevels = up.level;
                up.refund(-1);

                const doubleLevels = this.nextDouble(variables[i].level);

                if (maxLevels < doubleLevels) {
                    toMove.push(i);
                    continue;
                }

                const dumpLevels = maxLevels - this.lastDouble(variables[i].level + maxLevels);

                let cost = up.currency.value;
                up.buy(dumpLevels);
                cost -= up.currency.value;
                let dx = game.x;
                up.refund(dumpLevels);
                dx -= game.x;

                if (dx < dThreshold * game.x) {
                    toDelete.push(i);
                    continue;
                }

                if (best == null || best.dx * cost < dx * best.cost) {
                    best2 = best;
                    best = {
                        isDouble: true,
                        i: i,
                        dx: dx,
                        cost: cost,
                        cnt: dumpLevels
                    };
                } else if (best2 == null || best2.dx * cost < dx * best2.cost) {
                    best2 = {
                        isDouble: true,
                        i: i,
                        dx: dx,
                        cost: cost,
                        cnt: dumpLevels
                    };
                }

            }

            toMove.forEach(i => {doubleUps.delete(i); singleUps.add(i);});
            toDelete.forEach(i => {doubleUps.delete(i);});
            toDelete = [];

            for (const i of singleUps) {

                const up = starUps[i];
                const cost = up.cost.getCost(up.level);

                if (cost > up.currency.value) {
                    toDelete.push(i);
                    continue;
                }

                up.buy(1);
                let dx = game.x;
                up.refund(1);
                dx -= game.x;

                if (dx < sThreshold * game.x) {
                    toDelete.push(i);
                    continue;
                }

                if (best == null || best.dx * cost < dx * best.cost) {
                    best2 = best;
                    best = {
                        isDouble: false,
                        i: i,
                        dx: dx,
                        cost: cost,
                        cnt: 1
                    };
                } else if (best2 == null || best2.dx * cost < dx * best2.cost) {
                    best2 = {
                        isDouble: false,
                        i: i,
                        dx: dx,
                        cost: cost,
                        cnt: 1
                    };
                }

            }

            toDelete.forEach(i => {singleUps.delete(i);});

            if (best == null) break;

            if (best.isDouble) {
                starUps[best.i].buy(best.cnt);
                doubleUps.delete(best.i);
                singleUps.add(best.i);
            } else if (best2 == null) {
                starUps[best.i].buy(-1);
                singleUps.delete(best.i);
            } else {
                const bestup = starUps[best.i];
                let cost = best.cost;
                let dx = best.dx;
                for (let i = 0; i < MAX_ITER; i++) {
                    bestup.buy(1);

                    cost = bestup.cost.getCost(bestup.level);
                    if (cost > bestup.currency.value) break;
                    // mitigate edge cases where we have a cheap variable competing with an expensive one.
                    if (cost < trivialStars) continue;

                    bestup.buy(1);
                    dx = game.x;
                    bestup.refund(1);
                    dx -= game.x;

                    if (best2.dx * cost > dx * best2.cost) break;
                }
            }

        }

    }

    static nextDouble(level) {
        if (level >= 24000) return 400 - (level % 400);
        if (level >= 10000) return 200 - (level % 200);
        if (level >= 6000) return 100 - (level % 100);
        if (level >= 1500) return 50 - (level % 50);
        if (level >= 10) return 25 - (level % 25);
        return 10 - level;
    }

    static lastDouble(level) {
        if (level >= 24000) return level % 400;
        if (level >= 10000) return level % 200;
        if (level >= 6000) return level % 100;
        if (level >= 1500) return level % 50;
        if (level >= 25) return level % 25;
        if (level >= 10) return level - 10;
        return level;
    }

    static simpleStudent() {

        // number of purchases to backtrack and brute force; 4 if gradf < ee30k, 10 otherwise
        // const REFUND_CNT = game.statistics.graduationF < BigNumber.fromComponents(1, 2, 29994) ? 4 : 10;

        const upgrades = Array.from(game.researchUpgrades).filter(x => x.id <= 101 && x.isAvailable);
        upgrades.forEach(x => x.refund(-1));

        if (state.useR9) game.researchUpgrades[8].buy(-1);
        else game.researchUpgrades[8].refund(-1);

        const maxLevels = upgrades.map(x => x.maxLevel);
        const expIndex = upgrades.length - 1;
        let levels = upgrades.map(x => x.level);

        let sigma = game.sigma.toNumber();

        let curSum = BigNumber.ZERO;
        let history = [];

        // edit in case of emergency
        const vals = [
            (game.dt * game.acceleration * (game.isRewardActive ? 1.5 : 1)).log(),
            (1 + game.t).log() * 0.7,
            (1 + game.starsTotal).log(),
            (1 + game.db).log() / (100 * (10 + game.db).log10()).sqrt(),
            (1 + game.dmu).log() / 1300,
            (1 + game.dpsi).log() / 255 * (10 + game.dpsi).log10().sqrt()
        ].map(v => v.toNumber());

        while (true) {

            let cand = null;
            let cval = BigNumber.ZERO;

            for (let i = 0; i < upgrades.length; i++) {

                if (levels[i] >= maxLevels[i]) continue;

                const cost = (i == expIndex) ? 2 : this.researchCost(levels[i]);
                const curval = (i == expIndex) ? curSum/20 : vals[i]/cost;

                if (curval > cval) {
                    cand = (cost <= sigma) ? i : null; // flag if best is unreachable.
                    cval = curval;
                }
            }

            if (cand == null) break;

            history.push(cand);
            if (cand == expIndex) {
                sigma -= 2;
            } else {
                curSum += vals[cand];
                sigma -= this.researchCost(levels[cand]);
            }
            levels[cand] += 1;
        }

        while (history.length > 0) {
            
            let pool = 1;
            let dims = 0;

            for (let i = 0; i < upgrades.length; i++) {
                if (levels[i] >= maxLevels[i]) continue;
                let more = (i == expIndex) ? Math.floor(sigma / 2) : this.maxPurchaseCount(levels[i], sigma);
                pool *= Math.min(more, maxLevels[i] - levels[i]) + 1;
                dims += 1;
            }

            const heur = dims < 6 ? pool / 3 : pool / (dims == 6 ? 20 : 60)

            if (heur > this.MAX_DFS_SIZE) break;

            const lastbest = history.pop();

            if (lastbest == expIndex) {
                levels[lastbest] -= 1;
                sigma += 2;
            } else {
                const lastlevel = levels[lastbest] - 1;
                const lastcost = this.researchCost(lastlevel);
                levels[lastbest] -= 1;
                sigma += lastcost;
                curSum -= vals[lastbest];
            }
        }

        let search = (i, sigma, curSum) => { // TODO un-reuse variables
            if (i == expIndex) {
                const cnt = Math.min(levels[i] + sigma/2 >> 0, 6);
                return {cnt: [cnt], maxSum: curSum * (1 + cnt / 10)};
            }
            let maxres = null;
            for (let j = levels[i]; j <= maxLevels[i]; j++) {
                let res = search(i+1, sigma, curSum);
                if (maxres == null || res.maxSum >= maxres.maxSum) {
                    maxres = res;
                    maxres.cnt.push(j);
                }
                sigma -= this.researchCost(j);
                if (sigma < 0) break;
                curSum += vals[i];
            }
            return maxres;
        }

        const found = search(0, sigma, curSum);
        for (let i = 0; i <= expIndex; i++)
            upgrades[i].buy(found.cnt[expIndex - i]);

    }

    static researchCost(curLevel) {
        return Math.floor(curLevel/2 + 1);
    }

    static maxPurchaseCount(curLevel, sigma) {
        let levels = 0;

        if (this.researchCost(curLevel) > sigma) return levels;

        if (curLevel % 2 == 1) {
            sigma -= this.researchCost(curLevel);
            curLevel += 1;
            levels += 1;
        }

        curLevel += 1;
        const bulks = Math.floor((-curLevel + Math.sqrt(curLevel*curLevel + 4*sigma)) / 2);

        sigma -= bulks*(curLevel + bulks);
        curLevel += 2 * bulks - 1;
        levels += 2 * bulks;

        if (this.researchCost(curLevel) <= sigma) {
            levels += 1;
        }

        return levels;

    }

    static debugSimpleStudentSnapshot() {

        let output = {}
        output.sigma = game.sigma.toNumber();
        output.useR9 = state.useR9;
        Array.from(game.researchUpgrades).forEach(x => {output[x.id] = x.level;});
        return JSON.stringify(output);

    }

    static debugSimpleStudentPopup(debugTexts) {
        const output = debugTexts.join("\n");
        const popup = ui.createPopup({
            title: "STUDENT ERROR",
            content: ui.createStackLayout({
                children: [
                    ui.createLabel({text:output}),
                    ui.createEntry({placeholder:output})
                ]
            })
        })
        popup.show();
    }
}
AllocUtils.MAX_DFS_SIZE = 300;

// Tick actions
class ActionUtil {


    static theoryHandler(elapsedTime) {
        if (aTheoryState === undefined) return;

        aTheoryState.pubTime += elapsedTime;

        if (aTheoryState.publicationRatio > 1) {
            this.publishHandler(aTheoryState);
        }

        if (aTheoryState.useAutobuy) {
            this.theoryBuyHandler(aTheoryState);
        }
    }

    static publishHandler(aTheoryState) {
        const aTheory = game.activeTheory;
        if (aTheoryState.publicationRatio > 1 && aTheory.nextPublicationMultiplier >= aTheoryState.publicationRatio * aTheory.publicationMultiplier) {
            aTheory.publish();
        }
    }

    static theoryBuyHandler(aTheoryState) {
        const aTheory = game.activeTheory;
        let bought = false;
        for (const upgrade of aTheory.upgrades) {
            if (!upgrade.isAvailable) continue;
            const config = aTheoryState.autoBuyModes[upgrade.id];
            if (BuyModeUtils.buyCheck(upgrade, config)) {
                if (!bought) bought = true;
                BuyModeUtils.buyProcess(upgrade, config);
            }
        }
        return bought;
    }

    static resetHandler() {

        let action = false;

        // TODO check prestige condition

        state.prestigeExpr?.evaluate();
        if (state.prestigeExpr?.valueString !== undefined && state.prestigeExpr.valueString != "0") {
            game.prestige();
            action = true;
            state.prestigeExpr.initialize();
        }

        // TODO check supremacy condition
        state.supremacyExpr?.evaluate();
        if (state.supremacyExpr?.valueString !== undefined && state.supremacyExpr.valueString != "0") {
            game.supremacy();
            action = true;
            state.supremacyExpr.initialize();
        }

        // TODO check graduation condition
        state.graduationExpr?.evaluate();
        if (state.graduationExpr?.valueString !== undefined && state.graduationExpr.valueString != "0") {
            game.graduate();
            action = true;
            state.graduationExpr.initialize();
        }

        return action;
    }

}


class BuyModeUtils {
    
    static buyCheck(upgrade, config) {
        const custom = (upgrade, ratio) => upgrade.currency.value >= upgrade.cost.getCost(upgrade.level) * ratio;
        switch (config.mode) {
            case this.BUY_MODES.never:
                return false;
            case this.BUY_MODES.always:
                return custom(upgrade, 1);
            case this.BUY_MODES.tenth:
                return custom(upgrade, 10);
            case this.BUY_MODES.free_only:
                return upgrade.cost.getCost(upgrade.level) == 0;
            case this.BUY_MODES.custom:
                return custom(upgrade, config.ratio);
        }

    }

    static buyProcess(upgrade, config) {
        const custom = (upgrade, ratio) => {
            while (upgrade.currency.value >= upgrade.cost.getSum(upgrade.level, upgrade.level+100) * ratio) upgrade.buy(100);
            while (upgrade.currency.value >= upgrade.cost.getCost(upgrade.level) * ratio) upgrade.buy(1);
        };

        switch (config.mode) {
            case this.BUY_MODES.never:
                break;
            case this.BUY_MODES.always:
                custom(upgrade, 1);
                break;
            case this.BUY_MODES.tenth:
                custom(upgrade, 10);
                break;
            case this.BUY_MODES.free_only:
                if (upgrade.cost.getCost(upgrade.level) == 0) upgrade.buy(1);
                break;
            case this.BUY_MODES.custom:
                custom(upgrade, config.ratio);
                break;
        }
    }

    static buyString(config)  {
        switch (config.mode) {
            case this.BUY_MODES.never:
                return "never";
            case this.BUY_MODES.always:
                return "always";
            case this.BUY_MODES.tenth:
                return "1/10";
            case this.BUY_MODES.free_only:
                return "free only";
            case this.BUY_MODES.custom:
                return `custom: 1/${config.ratio}`;
        }
    }
}
BuyModeUtils.BUY_MODES = {
    never: 0,
    always: 1,
    tenth: 2,
    free_only: 3,
    custom: 4,

    next: (val) => (val + 1) % 5
};


class PopupUtils {
    static makeSimpleApplyPopup(heading, placeholder, description, onClicked) {

        let record = placeholder;

        let entry = ui.createEntry({
            placeholder: placeholder,
            onTextChanged: (_, s) => {record = s}
        })
        let apply = ui.createButton({
            text: "Apply"
        })
        let text = ui.createLabel({
            text: description
        })

        let popup = ui.createPopup({
            title: heading,
            content: ui.createStackLayout({
                children: [entry, text, apply]
            }),
        })

        apply.onClicked = () => {
            const res = onClicked(record);
            if (res) popup.hide();
        }

        return popup;
    }

    static showAutoBuyPopup(aTheoryId) {

        const aTheory = game.theories[aTheoryId];

        let popup = ui.createPopup({
            title: `${aTheory.name} Panel`
        })

        popup.content = PopupUtils.ratioContent(aTheory);
        
        popup.show();
    }

    static ratioContent(aTheory)  {

        const aTheoryState = state.theoryStates[aTheory.id];

        const NUM_COLS = 3;

        let buttons = [];
        let labels = [];
        for (const upgrade of aTheory.upgrades) {
            const desc = upgrade.description;
            const varname = desc.substring(2, desc.indexOf("=")); // Hacky way to get name

            const config = aTheoryState.autoBuyModes[upgrade.id];

            let label = ui.createLatexLabel({
                text: `\\(${varname}\\)`,
                horizontalTextAlignment: TextAlignment.CENTER,
                verticalTextAlignment: TextAlignment.END});
            labels.push(label);

            let button = ui.createButton();
            button.text = () => BuyModeUtils.buyString(config);

            const toggle = () => {
                config.mode = BuyModeUtils.BUY_MODES.next(config.mode);
            }
            const makePopup = () => {
                const heading = `${varname} ratio`;
                const placeholder = config.ratio.toString();
                const description = "Enter the desired ratio of (rho)/(price). Must be at least 1.";
                const onClicked = (record) => {
                    const isSuccess = BigNumber.tryParse(record, null);
                    if (!isSuccess) return false;
                    const num = parseBigNumber(record);
                    if (num < 1) return false;
                    config.ratio = num;
                    config.mode = BuyModeUtils.BUY_MODES.custom;
                    return true;
                }

                const popup = PopupUtils.makeSimpleApplyPopup(heading, placeholder, description, onClicked);
                popup.show();
            }
            button.onTouched = (e) => {
                if (e.x < 0 || e.x > button.width || e.y < 0 || e.y > button.height) return;
                switch (e.type) {
                    case TouchType.SHORTPRESS_RELEASED:
                        toggle();
                        break;
                    case TouchType.LONGPRESS:
                        makePopup();
                        break;
                    default:
                        break;
                }
            }
            buttons.push(button);
        }

        for (let i = 0; i < aTheory.upgrades.length; i++) {
            const rem = i % NUM_COLS;
            const quo = (i - rem) / NUM_COLS;
            labels[i].row = 2 * quo;
            labels[i].column = rem;
            buttons[i].row = 2 * quo + 1;
            buttons[i].column = rem;
        }

        let rowDefinitions = [];
        for (let i = 0; i < aTheory.upgrades.length; i = i + NUM_COLS) {
            rowDefinitions.push("1*");
            rowDefinitions.push("2*");
        }

        const content = ui.createGrid({
            rowDefinitions: rowDefinitions,
            children: buttons.concat(labels)
        })

        return content;
    }

    static showPubRatioPopup(aTheoryId) {
        const aTheory = game.theories[aTheoryId];
        const aTheoryState = state.theoryStates[aTheoryId];

        const heading = `${aTheory.name} Ratio`;
        const placeholder = aTheoryState.publicationRatio.toString();
        const description = `Enter the publication ratio desired. Values 1 or less count as never`;
        const onClicked = (record) => {
            const isSuccess = BigNumber.tryParse(record, null);
            if (!isSuccess) return false;
            const num = parseBigNumber(record);
            aTheoryState.publicationRatio = num;
            return true;
        }
        const popup = PopupUtils.makeSimpleApplyPopup(heading, placeholder, description, onClicked);

        popup.show();
    }

    static showAutoFreqPopup() {

        let record = state.autoFreq.toString();

        let entry = ui.createEntry({
            placeholder: record,
            onTextChanged: (_, s) => {record = s}
        })
        let apply = ui.createButton({
            text: "Apply"
        })

        let text = ui.createLabel({
            text: `Enter the frequency of auto reallocation. Values less than ${MIN_FREQ} are ignored.`
        })

        let popup = ui.createPopup({
            title: `Reallocation Frequency`,
            content: ui.createStackLayout({
                children: [entry, text, apply]
            }),
        })

        apply.onClicked = () => {
            if (record.endsWith('debug')) {
                state.debug = true;
                record = record.slice(0, -5);
            } else {
                state.debug = false;
            }
            const num = parseInt(record);
            if (isNaN(num)) return;
            state.autoFreq = num;
            popup.hide();
        }

        popup.show();

    }

    static showVarPopup(target) {

        if (expState === undefined) throw "NO EXP STATE"

        if (!(target in MathExpUtils.TARGET_NAME)) throw `Popup called for invalid var target ${target}`

        const map = expState.targetMap(target);
        const order = expState.targetOrder(target);

        let popup;

        let entries = [];

        for (let i = 0; i < order.length; i++) {
            const name = order[i];
            const entry = this.varEntry(target, i, name, map[name], () => popup.hide());
            entries.push(entry);
        }

        let create = ui.createButton({text: "CREATE"})

        popup = ui.createPopup({
            title: MathExpUtils.TARGET_NAME_STR[target],
            content: ui.createStackLayout({
                children: [
                    ui.createScrollView({
                        content: ui.createStackLayout({children: entries})
                    }),
                    create
                ]
            })
            
        })

        create.onClicked = () => {
            this.varPopup(target)
            popup.hide();
        }

        popup.show();
        
    }

    static varEntry(target, index, name, el, callback) {
        
        const label = ui.createLabel({text: () => `${name} = ${el.value}`, fontSize: 14});
        const expr = ui.createLabel({text: () => `${name}ₜ ← ${el.str ?? ""}`, fontSize: 14});
        const iexpr = ui.createLabel({text: () => `${name}₀ ← ${el.init ?? ""}`, fontSize: 14});
        const umode = ui.createLabel({
            text: () => "update: " + MathExpUtils.MODESET_STR[el.updateMode],
            fontSize: 12,
            row: 0,
            column: 0
        });
        const rmode = ui.createLabel({
            text: () => "reset: " + MathExpUtils.MODESET_STR[el.resetMode],
            fontSize: 12,
            row: 0,
            column: 1
        });

        const modeContent = ui.createGrid({children: [umode, rmode]});

        const labelContent = ui.createStackLayout({
            children: [label, expr, iexpr, modeContent],
            row: 0,
            column: 0
        });
        
        let edit = ui.createButton({text: "EDIT", backgroundColor: Color.fromRgb(0.4, 0.4, 0.4)})
        let remove = ui.createButton({text: "DELETE", backgroundColor: Color.fromRgb(0.4, 0.4, 0.4)})

        const buttonContent = ui.createStackLayout({
            children: [edit, remove],
            row: 0,
            column: 1
        })

        const content = ui.createGrid({
            children: [labelContent, buttonContent],
            columnDefinitions: ["1*", "50"],
            margin: new Thickness(5)
        })

        edit.onClicked = () => {
            this.varPopup(target, name, index, el)
            callback();
        }
        
        remove.onClicked = () => {
            expState.delVar(target, name, index);
            callback();
        }

        return ui.createFrame({
            content: content,
            backgroundColor: Color.fromRgb(0.2, 0.2, 0.2)
        });
    }

    static varPopup(target, name, index, el) {
        
        const titleStr = ((el && "Edit") ?? "Create") + ` ${MathExpUtils.TARGET_NAME_STR[target]}`

        let nameLabel = ui.createLabel({text: "Name"})
        let nameRecord = name ?? "";
        let nameEntry = ui.createEntry({
            placeholder: nameRecord,
            onTextChanged: (_, s) => {nameRecord = s}
        })

        let strLabel = ui.createLabel({text: "Expression"})
        let strRecord = el?.str ?? "";
        let strEntry = ui.createEntry({
            placeholder: strRecord,
            onTextChanged: (_, s) => {strRecord = s}
        })

        let initLabel = ui.createLabel({text: "Initial Value"})
        let initRecord = el?.init ?? "";
        let initEntry = ui.createEntry({
            placeholder: initRecord,
            onTextChanged: (_, s) => {initRecord = s}
        })

        const modesetIter = {};
        let modesetPrev = MathExpUtils.MODESET.PUBLISH;
        for (const mode in MathExpUtils.MODESET) modesetIter[modesetPrev] = modesetPrev = mode;

        let updateModeLabel = ui.createLabel({text: "Update Mode"})
        let updateModeRecord = el?.updateMode ?? MathExpUtils.MODESET.NONE;
        let updateModeButton = ui.createButton({
            text: () => MathExpUtils.MODESET_STR[updateModeRecord],
            onClicked: () => {updateModeRecord = modesetIter[updateModeRecord]}
        })
        
        let resetModeLabel = ui.createLabel({text: "Reset Mode"})
        let resetModeRecord = el?.resetMode ?? MathExpUtils.MODESET.NONE;
        let resetModeButton = ui.createButton({
            text: () => MathExpUtils.MODESET_STR[resetModeRecord],
            onClicked: () => {resetModeRecord = modesetIter[resetModeRecord]}
        })

        const gridArr = [
            [nameLabel, nameEntry],
            [strLabel, strEntry],
            [initLabel, initEntry],
            [updateModeLabel, updateModeButton],
            [resetModeLabel, resetModeButton]
        ]

        let gridChildren = [];
        let i = 0;
        for (const row of gridArr) {
            let j = 0;
            for (const item of row) {
                item.row = i;
                item.column = j++;
                gridChildren.push(item);
            }
            i++;
        }

        const grid = ui.createGrid({
            rowDefinitions: ["50", "1*"],
            children: gridChildren
        })


        let apply = ui.createButton({
            text: "Apply"
        })
        let cancel = ui.createButton({
            text: "Cancel"
        })

        let popup = ui.createPopup({
            title: titleStr,
            content: ui.createStackLayout({
                children: [grid, apply, cancel]
            }),
        })

        const applyAction = () => {

            if (nameRecord.length == 0) return;

            const str = strRecord.length > 0 ? strRecord : undefined;
            const init = initRecord.length > 0 ? initRecord : undefined;

            const newobj = {str: str, init: init, updateMode: updateModeRecord, resetMode: resetModeRecord}

            if (el === undefined) {
                expState.addVar(target, nameRecord, undefined, newobj);
            } else {
                expState.editVar(target, name, index, nameRecord, el, newobj, init !== undefined);
            }

            popup.hide();

        }

        const cancelAction = () => {popup.hide();};

        apply.onClicked = applyAction;
        cancel.onClicked = cancelAction;

        popup.show();

    }

    static showExprPopup(mode) {
        if (!(mode in this.exprLabels)) throw `Invalid expr mode ${mode}`

        const entry = this.exprLabels[mode];

        const popup = this.makeSimpleApplyPopup(
            entry.s,
            state[entry.v]?.str ?? "",
            "",
            record => {
                if (state[entry.v] === undefined) {
                    state[entry.v] = CustomME.create(record)
                } else {
                    state[entry.v].update({str: record});
                    state[entry.v].initialize();
                }
                return true;
            }
        );

        popup.show();
    }
}
PopupUtils.exprLabels = {
    [MathExpUtils.MODESET.PRESTIGE]: {v: 'prestigeExpr', s: 'Prestige Expression'},
    [MathExpUtils.MODESET.SUPREMACY]: {v: 'supremacyExpr', s: 'Supremacy Expression'},
    [MathExpUtils.MODESET.GRADUATION]: {v: 'graduationExpr', s: 'Graduation Expression'}
}


var customReplacer = (_, val) => {
    try {
        if (val instanceof BigNumber) return "BigNumber" + val.toBase64String(); // BigNumber
    } catch {}
    return val;
}
var customReviver = (_, val) => {
    if (val && typeof val === 'string') {
        if (val.startsWith("BigNumber")) return BigNumber.fromBase64String(val.substring(9));
    }
    return val;
}

var getInternalState = () => state.serialize();

var setInternalState = (s) => {
    if (s) {
        state.importSerialization(s);
        ManagementUtils.refresh();
    }
}

// helpers
var Base64;
{
    /**
    *
    *  Base64 encode / decode
    *  http://www.webtoolkit.info/
    *
    **/
    Base64 = {

        // private property
        _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

        // public method for encoding
        encode : function (input) {
            var output = "";
            var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
            var i = 0;

            input = Base64._utf8_encode(input);

            while (i < input.length) {

                chr1 = input.charCodeAt(i++);
                chr2 = input.charCodeAt(i++);
                chr3 = input.charCodeAt(i++);

                enc1 = chr1 >> 2;
                enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                enc4 = chr3 & 63;

                if (isNaN(chr2)) {
                    enc3 = enc4 = 64;
                } else if (isNaN(chr3)) {
                    enc4 = 64;
                }

                output = output +
                this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
                this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
            }
            return output;
        },

        // public method for decoding
        decode : function (input) {
            var output = "";
            var chr1, chr2, chr3;
            var enc1, enc2, enc3, enc4;
            var i = 0;

            input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

            while (i < input.length) {

                enc1 = this._keyStr.indexOf(input.charAt(i++));
                enc2 = this._keyStr.indexOf(input.charAt(i++));
                enc3 = this._keyStr.indexOf(input.charAt(i++));
                enc4 = this._keyStr.indexOf(input.charAt(i++));

                chr1 = (enc1 << 2) | (enc2 >> 4);
                chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                chr3 = ((enc3 & 3) << 6) | enc4;

                output = output + String.fromCharCode(chr1);

                if (enc3 != 64) {
                    output = output + String.fromCharCode(chr2);
                }
                if (enc4 != 64) {
                    output = output + String.fromCharCode(chr3);
                }
            }

            output = Base64._utf8_decode(output);

            return output;
        },

        // private method for UTF-8 encoding
        _utf8_encode : function (string) {
            string = string.replace(/\r\n/g,"\n");
            var utftext = "";

            for (var n = 0; n < string.length; n++) {

                var c = string.charCodeAt(n);

                if (c < 128) {
                    utftext += String.fromCharCode(c);
                }
                else if((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
                else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
            }
            return utftext;
        },

        // private method for UTF-8 decoding
        _utf8_decode : function (utftext) {
            var string = "";
            var i = 0;
            var c = c1 = c2 = 0;

            while ( i < utftext.length ) {

                c = utftext.charCodeAt(i);

                if (c < 128) {
                    string += String.fromCharCode(c);
                    i++;
                }
                else if((c > 191) && (c < 224)) {
                    c2 = utftext.charCodeAt(i+1);
                    string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                    i += 2;
                }
                else {
                    c2 = utftext.charCodeAt(i+1);
                    c3 = utftext.charCodeAt(i+2);
                    string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                    i += 3;
                }
            }
            return string;
        }
    }

}

init();