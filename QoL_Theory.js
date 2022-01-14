import { FreeCost } from "../api/Costs";
import { game } from "../api/Game";
import { Permissions } from "../api/Permissions"
import { theory } from "../api/Theory";
import { BigNumber } from "./api/BigNumber";
import { ui } from "../api/ui/UI"

var id = "eaux_qol";
var name = "QoL Theory";
var description = "A custom theory for finer main theory auto-purchase controls and heuristic-based star/student reallocation";
var authors = "Eaux Tacous#1021";
var version = 4;
var permissions = Permissions.PERFORM_GAME_ACTIONS

var currency;
var reStar, reSigma, pubRatio, theoryButton, autoFreqButton;

var autoBuyPopups, publicationRatioPopups, autoFreqPopup;
var autoBuyModes, publicationRatios, autoFreq;

const MIN_FREQ = 10;

var init = () => {
    currency = theory.createCurrency();

    genTables();

    // Toggle restar
    {
        reStar = theory.createSingularUpgrade(1, currency, new FreeCost());
        reStar.description = reStar.info = "Reallocate Stars";
        reStar.bought = (_) => simpleStar();
    }

    // Toggle resigma
    {
        reSigma = theory.createSingularUpgrade(2, currency, new FreeCost());
        reSigma.description = reSigma.info = "Reallocate Students";
        reSigma.bought = (_) => simpleStudent();
    }

    {
        autoFreqButton = theory.createSingularUpgrade(3, currency, new FreeCost());
        autoFreqButton.getDescription = autoFreqButton.getInfo = (amount) => {
            const f = (autoFreq < MIN_FREQ) ? "Never" : autoFreq.toString() + " ticks";
            return "Auto-reallocation frequency: " + f
        }
        autoFreqButton.bought = (_) => {
            autoFreqPopup.show();
        }
    }

    // pubRatio
    {
        pubRatio = theory.createSingularUpgrade(4, currency, new FreeCost());

        pubRatio.getDescription = pubRatio.getInfo = (amount) => {
            const aTheory = game.activeTheory;
            if (aTheory == null || aTheory.id == 8) return "Error: Invalid Theory";
            return "Publication Ratio:\ " + Utils.getMath(publicationRatios[aTheory.id])
        };

        pubRatio.bought = (_) => {
            const aTheory = game.activeTheory;
            if (aTheory == null || aTheory.id == 8) return;
            publicationRatioPopups[aTheory.id].show();
        }
    }

    {
        theoryButton = theory.createSingularUpgrade(5, currency, new FreeCost());
        theoryButton.description = theoryButton.info = "Theory Autobuy Menu";
        theoryButton.bought = (_) => {
            const aTheory = game.activeTheory;
            if (aTheory == null || aTheory.id == 8) return;
            autoBuyPopups[aTheory.id].show();
        }
    }


}

// Star utility

var simpleStar;
{
    const nextDouble = (level) => {
        if (level >= 24000) return 400 - (level % 400);
        if (level >= 10000) return 200 - (level % 200);
        if (level >= 6000) return 100 - (level % 100);
        if (level >= 1500) return 50 - (level % 50);
        if (level >= 10) return 25 - (level % 25);
        return 10 - level;
    }

    const lastDouble = (level) => {
        if (level >= 24000) return level % 400;
        if (level >= 10000) return level % 200;
        if (level >= 6000) return level % 100;
        if (level >= 1500) return level % 50;
        if (level >= 25) return level % 25;
        if (level >= 10) return level - 10;
        return level;
    }

    simpleStar = () => {

        const starUps = Array.from(game.starBonuses).filter(x => x.id >= 4000 && x.id < 5000);
        const variables = Array.from(game.variables).filter(x => x.id > 0);

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

                const doubleLevels = nextDouble(variables[i].level);

                if (maxLevels < doubleLevels) {
                    toMove.push(i);
                    continue;
                }

                const dumpLevels = maxLevels - lastDouble(variables[i].level + maxLevels);

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
}


// Student utility

var simpleStudent;
{
    const researchCost = curLevel => curLevel/2 + 1 >> 0;

    const REFUND_CNT = 3; // number of purchases to backtrack and brute force

    simpleStudent = () => {

        const upgrades = Array.from(game.researchUpgrades).filter(x => x.id <= 101);
        upgrades.forEach(x => x.refund(-1));
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
        ];

        while (true) {

            let cand = null;
            let cval = BigNumber.ZERO;

            for (let i = 0; i < upgrades.length; i++) {

                if (levels[i] >= maxLevels[i]) continue;

                const cost = (i == expIndex) ? 2 : researchCost(levels[i]);
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
                sigma -= researchCost(levels[cand]);
            }
            levels[cand] += 1;
        }

        for (let i = 0; i < REFUND_CNT; i++) {
            if (history.length == 0) break;

            const lastbest = history.pop();

            if (lastbest == expIndex) {
                levels[lastbest] -= 1;
                sigma += 2;
            } else {
                const lastlevel = levels[lastbest] - 1;
                const lastcost = researchCost(lastlevel);
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
                sigma -= researchCost(j);
                if (sigma < 0) break;
                curSum += vals[i];
            }
            return maxres;
        }

        const found = search(0, sigma, curSum);
        for (let i = 0; i <= expIndex; i++)
            upgrades[i].buy(found.cnt[expIndex - i]);

    }
}

// Tick actions

var theoryHandler;
{
    const publishHandler = (aTheory) => {
        if (aTheory.nextPublicationMultiplier >= publicationRatios[aTheory.id] * aTheory.publicationMultiplier) aTheory.publish();
    }

    const theoryBuyHandler = (aTheory) => {
        for (const upgrade of aTheory.upgrades) {
            const mode = autoBuyModes[aTheory.id][upgrade.id];
            MODE_HANDLERS[mode](upgrade);
        }
    }

    theoryHandler = () => {
        const aTheory = game.activeTheory;
        if (aTheory == null || aTheory.id == 8) return;

        publishHandler(aTheory);
        theoryBuyHandler(aTheory);
    }
}

var tick = (elapsedTime, multiplier) => {

    theoryHandler();

    if (autoFreq >= MIN_FREQ && game.statistics.tickCount % autoFreq == 0) {
        simpleStar();
        simpleStudent();
    }

}

const MODE_STRS = ["never", "always", "1/10", "free only"];
const NUM_MODES = MODE_STRS.length;
var MODE_HANDLERS;
{
    const never = (_) => {};
    const always = (upgrade) => {
        while (upgrade.currency.value >= upgrade.cost.getSum(upgrade.level, upgrade.level+100)) upgrade.buy(100);
        while (upgrade.currency.value >= upgrade.cost.getCost(upgrade.level)) upgrade.buy(1);
    };
    const tenth = (upgrade) => {
        while (upgrade.currency.value / 10 >= upgrade.cost.getSum(upgrade.level, upgrade.level+100)) upgrade.buy(100);
        while (upgrade.currency.value / 10 >= upgrade.cost.getCost(upgrade.level)) upgrade.buy(1);
    };
    const freeOnly = (upgrade) => {
        if (upgrade.cost.getCost(upgrade.level) == 0) upgrade.buy(1);
    }
    MODE_HANDLERS = [never, always, tenth, freeOnly];
}

var genpopups, genTables;
{
    genTables = () => {
        autoBuyModes = {};
        for (const aTheory of game.theories) {
            if (aTheory.id == 8) continue;
            autoBuyModes[aTheory.id] = {};
            for (const upgrade of aTheory.upgrades) {
                autoBuyModes[aTheory.id][upgrade.id] = 0;
            }
        }

        publicationRatios = {};
        for (const aTheory of game.theories) {
            publicationRatios[aTheory.id] = 100;
        }

        autoFreq = 100;
    }

    const genAutoBuyPopups = () => {
        autoBuyPopups = {}
        const NUM_COLS = 3;
        for (const aTheory of game.theories) {
            if (aTheory.id == 8) continue;
            let buttons = [];
            let labels = [];
            let mode = autoBuyModes[aTheory.id];
            for (const upgrade of aTheory.upgrades) {
                const desc = upgrade.description;
                const varname = desc.substring(2, desc.indexOf("=")); // Hacky way to get name

                let label = ui.createLatexLabel({
                    text: `\\(${varname}\\)`,
                    horizontalTextAlignment: TextAlignment.CENTER,
                    verticalTextAlignment: TextAlignment.END});
                labels.push(label);

                let button = ui.createButton();
                button.text = () => MODE_STRS[mode[upgrade.id]];
                button.onClicked = () => {
                    mode[upgrade.id] += 1;
                    mode[upgrade.id] %= NUM_MODES;
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

            let popup = ui.createPopup({
                title: `${aTheory.name} Panel`,
                content: ui.createGrid({
                    rowDefinitions: rowDefinitions,
                    children: buttons.concat(labels)
                })
            })

            autoBuyPopups[aTheory.id] = popup;
            autoBuyModes[aTheory.id] = mode;

        }
    }

    const genPublicationRatioPopups = () => {
        publicationRatioPopups = {};
        for (const aTheory of game.theories) {

            let record = publicationRatios[aTheory.id].toString();

            let entry = ui.createEntry({
                placeholder: record,
                onTextChanged: (_, s) => {record = s}
            })
            let apply = ui.createButton({
                text: "Apply"
            })

            let popup = ui.createPopup({
                title: `${aTheory.name} Ratio`,
                content: ui.createStackLayout({
                    children: [entry, apply]
                }),
            })

            apply.onClicked = () => {
                const num = parseFloat(record);
                if (isNaN(num) || num <= 1) return;
                publicationRatios[aTheory.id] = num;
                popup.hide();
            }

            publicationRatioPopups[aTheory.id] = popup;
        }
    }

    const genAutoFreqPopup = () => {

        let record = autoFreq.toString();

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
            const num = parseInt(record);
            if (isNaN(num)) return;
            autoFreq = num;
            popup.hide();
        }

        autoFreqPopup = popup
    }

    genpopups = () => {
        genAutoBuyPopups();
        genPublicationRatioPopups();
        genAutoFreqPopup();
    }
}


var getInternalState = () => JSON.stringify({autoBuyModes: autoBuyModes, publicationRatios: publicationRatios, autoFreq: autoFreq});
var setInternalState = (state) => {
    if (state) {
        const newState = JSON.parse(state);
        autoBuyModes = newState.autoBuyModes;
        publicationRatios = newState.publicationRatios;
        autoFreq = newState.autoFreq;
    }
    genpopups();
}

init();