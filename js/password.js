import PRELOADED_CATEGORIES from "../data/categories.js";
import * as storage from "./storage.js";
import { fetchPasswordDeckFromOpenAI, loadApiKey } from "./openai.js";

const MIN_DECK_SIZE = 20;
const MIN_PLAYABLE = 5;
const MAX_TEAM_NAME_LEN = 48;
/** Points awarded to the team tapped when they get the password (no clue ladder in co-view mode). */
const POINTS_PER_SOLVE = 1;

const state = {
    categoryName: "",
    /** @type {{ answer: string }[]} */
    deck: [],
    pointer: 0,
    teamA: 0,
    teamB: 0,
    targetScore: 0,
    teamNameA: "",
    teamNameB: "",
};

const el = {
    setup: /** @type { HTMLElement } */ ( document.getElementById( "screen-setup" )),
    category: /** @type { HTMLElement } */ ( document.getElementById( "screen-category" )),
    loading: /** @type { HTMLElement } */ ( document.getElementById( "screen-loading" )),
    play: /** @type { HTMLElement } */ ( document.getElementById( "screen-play" )),
    sessionEnd: /** @type { HTMLElement } */ ( document.getElementById( "screen-session-end" )),
    passwordTarget: /** @type { HTMLSelectElement } */ ( document.getElementById( "password-target" )),
    passwordTeamA: /** @type { HTMLInputElement } */ ( document.getElementById( "password-team-a" )),
    passwordTeamB: /** @type { HTMLInputElement } */ ( document.getElementById( "password-team-b" )),
    btnTeamAWon: /** @type { HTMLButtonElement } */ ( document.getElementById( "btn-team-a-won" )),
    btnTeamBWon: /** @type { HTMLButtonElement } */ ( document.getElementById( "btn-team-b-won" )),
    customCategories: /** @type { HTMLElement } */ ( document.getElementById( "custom-categories" )),
    includedCategories: /** @type { HTMLElement } */ ( document.getElementById( "included-categories" )),
    loadingMessage: /** @type { HTMLElement } */ ( document.getElementById( "loading-message" )),
    scoreA: /** @type { HTMLElement } */ ( document.getElementById( "score-a" )),
    scoreB: /** @type { HTMLElement } */ ( document.getElementById( "score-b" )),
    passwordTargetMeta: /** @type { HTMLElement } */ ( document.getElementById( "password-target-meta" )),
    playCategory: /** @type { HTMLElement } */ ( document.getElementById( "play-category" )),
    playPassword: /** @type { HTMLElement } */ ( document.getElementById( "play-password" )),
    sessionEndTitle: /** @type { HTMLElement } */ ( document.getElementById( "session-end-title" )),
    sessionEndSummary: /** @type { HTMLElement } */ ( document.getElementById( "session-end-summary" )),
    sessionEndScores: /** @type { HTMLElement } */ ( document.getElementById( "session-end-scores" )),
};

const showScreen = ( active ) => {
    [ el.setup, el.category, el.loading, el.play, el.sessionEnd ].forEach(( node ) => {
        node.classList.toggle( "screen--active", node === active );
    });
};

const shuffle = ( array ) => {
    const arr = array.slice();
    for ( let i = arr.length - 1; i > 0; i-- ) {
        const j = Math.floor( Math.random() * ( i + 1 ));
        [ arr[i], arr[j] ] = [ arr[j], arr[i] ];
    }
    return arr;
};

/**
 * @param { unknown } raw
 * @returns { string }
 */
const normalizeTeamName = ( raw ) => {
    if ( typeof raw !== "string" ) {
        return "";
    }
    return raw.trim().slice( 0, MAX_TEAM_NAME_LEN );
};

const labelTeamA = () => ( state.teamNameA ? state.teamNameA : "Team A" );

const labelTeamB = () => ( state.teamNameB ? state.teamNameB : "Team B" );

const hydrateTeamNamesFromStorage = () => {
    const s = storage.loadSettings();
    state.teamNameA = normalizeTeamName( s.passwordTeamNameA );
    state.teamNameB = normalizeTeamName( s.passwordTeamNameB );
};

const stripSeenPassword = ( deck, category ) => {
    const seen = storage.loadSeenAnswersPassword( category );
    return deck.filter(( c ) => !seen.includes( c.answer ));
};

/**
 * @param { unknown[] } cards
 * @returns {{ answer: string }[]}
 */
const normalizeToPasswordCards = ( cards ) => {
    if ( !Array.isArray( cards )) {
        return [];
    }
    const out = /** @type {{ answer: string }[]} */ ([]);
    cards.forEach(( c ) => {
        if ( !c || typeof c !== "object" ) {
            return;
        }
        const a = typeof /** @type { any } */ ( c ).answer === "string" ? /** @type { any } */ ( c ).answer.trim() : "";
        if ( a ) {
            out.push({ answer: a });
        }
    });
    return out;
};

const buildDeckForCategory = async ( category ) => {
    const seen = storage.loadSeenAnswersPassword( category );

    let best = /** @type {{ answer: string }[]} */ ([]);

    const pre = PRELOADED_CATEGORIES[category];
    if ( Array.isArray( pre )) {
        const normalized = normalizeToPasswordCards( pre );
        const stripped = stripSeenPassword( normalized, category );
        if ( stripped.length > best.length ) {
            best = stripped;
        }
    }

    const stored = storage.loadStoredDeckPassword( category );
    if ( Array.isArray( stored )) {
        const normalized = normalizeToPasswordCards( stored );
        const stripped = stripSeenPassword( normalized, category );
        if ( stripped.length > best.length ) {
            best = stripped;
        }
    }

    if ( best.length < MIN_DECK_SIZE ) {
        el.loadingMessage.textContent = "Generating passwords with OpenAI…";
        const apiKey = await loadApiKey();
        const fetched = await fetchPasswordDeckFromOpenAI( apiKey, category, seen );
        if ( fetched && /** @type { any } */ ( fetched ).error ) {
            throw new Error( /** @type { any } */ ( fetched ).error );
        }
        if ( !Array.isArray( fetched )) {
            throw new Error( "Could not load deck." );
        }
        storage.saveDeckPassword( category, fetched );
        best = stripSeenPassword( fetched, category );
    }

    if ( best.length < MIN_PLAYABLE ) {
        throw new Error(
            "Not enough passwords left for this category. Pick another category or clear local storage for this site.",
        );
    }

    return shuffle( best );
};

const syncSettingsToState = () => {
    const t = Number( el.passwordTarget.value );
    state.targetScore = Number.isFinite( t ) && t >= 0 ? Math.floor( t ) : 0;
    state.teamNameA = normalizeTeamName( el.passwordTeamA.value );
    state.teamNameB = normalizeTeamName( el.passwordTeamB.value );
    storage.saveSettings({
        passwordTargetScore: state.targetScore,
        passwordTeamNameA: state.teamNameA,
        passwordTeamNameB: state.teamNameB,
    });
};

const applySettingsToForm = () => {
    const s = storage.loadSettings();
    el.passwordTarget.value = String( s.passwordTargetScore );
    state.teamNameA = normalizeTeamName( s.passwordTeamNameA );
    state.teamNameB = normalizeTeamName( s.passwordTeamNameB );
    el.passwordTeamA.value = state.teamNameA;
    el.passwordTeamB.value = state.teamNameB;
};

const updateTeamWinButtonLabels = () => {
    el.btnTeamAWon.textContent = `${labelTeamA()} got it`;
    el.btnTeamBWon.textContent = `${labelTeamB()} got it`;
};

const updateScoreboard = () => {
    el.scoreA.textContent = `${labelTeamA()}: ${state.teamA}`;
    el.scoreB.textContent = `${labelTeamB()}: ${state.teamB}`;
    updateTeamWinButtonLabels();
    if ( state.targetScore > 0 ) {
        el.passwordTargetMeta.textContent = `First to ${state.targetScore} points`;
    }
    else {
        el.passwordTargetMeta.textContent = "Free play — no win target";
    }
};

const getCurrentCard = () => state.deck[state.pointer] || null;

const renderPlay = () => {
    const card = getCurrentCard();
    if ( !card ) {
        return;
    }
    el.playCategory.textContent = `Category: ${state.categoryName}`;
    el.playPassword.textContent = card.answer;
};

const startPlaySession = () => {
    hydrateTeamNamesFromStorage();
    state.pointer = 0;
    state.teamA = 0;
    state.teamB = 0;
    updateScoreboard();
    showScreen( el.play );
    renderPlay();
};

const maybeWin = () => {
    if ( state.targetScore <= 0 ) {
        return false;
    }
    if ( state.teamA >= state.targetScore || state.teamB >= state.targetScore ) {
        const winner = state.teamA >= state.targetScore ? labelTeamA() : labelTeamB();
        el.sessionEndTitle.textContent = "We have a winner";
        el.sessionEndSummary.textContent = `${winner} reached ${state.targetScore} points first.`;
        el.sessionEndScores.textContent = `${labelTeamA()}: ${state.teamA}\n${labelTeamB()}: ${state.teamB}`;
        showScreen( el.sessionEnd );
        return true;
    }
    return false;
};

const advanceAfterSolveOrSkip = () => {
    state.pointer += 1;
    if ( state.pointer >= state.deck.length ) {
        el.sessionEndTitle.textContent = "Deck finished";
        el.sessionEndSummary.textContent = "No more passwords in this category.";
        el.sessionEndScores.textContent = `${labelTeamA()}: ${state.teamA}\n${labelTeamB()}: ${state.teamB}`;
        showScreen( el.sessionEnd );
        return;
    }
    renderPlay();
};

/**
 * @param { "A" | "B" } team
 */
const onTeamWon = ( team ) => {
    const card = getCurrentCard();
    if ( !card ) {
        return;
    }
    if ( team === "A" ) {
        state.teamA += POINTS_PER_SOLVE;
    }
    else {
        state.teamB += POINTS_PER_SOLVE;
    }
    storage.saveSeenAnswerPassword( state.categoryName, card.answer );
    updateScoreboard();
    if ( maybeWin()) {
        return;
    }
    advanceAfterSolveOrSkip();
};

const onSkipWord = () => {
    const card = getCurrentCard();
    if ( !card ) {
        return;
    }
    storage.saveSeenAnswerPassword( state.categoryName, card.answer );
    advanceAfterSolveOrSkip();
};

const beginCategory = async ( category ) => {
    state.categoryName = category;
    showScreen( el.loading );
    el.loadingMessage.textContent = "Loading deck…";
    try {
        state.deck = await buildDeckForCategory( category );
        startPlaySession();
    }
    catch ( err ) {
        console.error( err );
        alert( String( err?.message || err ));
        showScreen( el.category );
    }
};

const populateCategories = () => {
    el.includedCategories.innerHTML = "";
    Object.keys( PRELOADED_CATEGORIES ).forEach(( name ) => {
        const btn = document.createElement( "button" );
        btn.type = "button";
        btn.className = "category-chip";
        btn.textContent = name;
        btn.addEventListener( "click", () => beginCategory( name ));
        el.includedCategories.appendChild( btn );
    });

    el.customCategories.innerHTML = "";
    storage.loadCustomCategories().forEach(( name ) => {
        const btn = document.createElement( "button" );
        btn.type = "button";
        btn.className = "category-chip";
        btn.textContent = name;
        btn.addEventListener( "click", () => beginCategory( name ));
        el.customCategories.appendChild( btn );
    });
};

const resetToCategoryPicker = () => {
    state.deck = [];
    state.pointer = 0;
    state.categoryName = "";
    populateCategories();
    showScreen( el.category );
};

document.getElementById( "btn-setup-continue" )?.addEventListener( "click", () => {
    syncSettingsToState();
    populateCategories();
    showScreen( el.category );
});

document.getElementById( "btn-category-back" )?.addEventListener( "click", () => {
    showScreen( el.setup );
});

document.getElementById( "btn-add-custom" )?.addEventListener( "click", () => {
    const name = window.prompt( "Enter a custom category:" );
    if ( !name || !name.trim()) {
        return;
    }
    const trimmed = name.trim();
    storage.saveCustomCategory( trimmed );
    populateCategories();
    beginCategory( trimmed );
});

document.getElementById( "btn-clear-custom" )?.addEventListener( "click", () => {
    if ( window.confirm( "Remove all custom categories from this device?" )) {
        storage.clearCustomCategories();
        populateCategories();
    }
});

document.getElementById( "btn-team-a-won" )?.addEventListener( "click", () => onTeamWon( "A" ));

document.getElementById( "btn-team-b-won" )?.addEventListener( "click", () => onTeamWon( "B" ));

document.getElementById( "btn-skip-word" )?.addEventListener( "click", onSkipWord );

document.getElementById( "btn-play-change-category" )?.addEventListener( "click", resetToCategoryPicker );

document.getElementById( "btn-session-new-category" )?.addEventListener( "click", resetToCategoryPicker );

el.passwordTarget.addEventListener( "change", syncSettingsToState );

el.passwordTeamA.addEventListener( "input", syncSettingsToState );

el.passwordTeamB.addEventListener( "input", syncSettingsToState );

applySettingsToForm();
showScreen( el.setup );
