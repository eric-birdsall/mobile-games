import PRELOADED_CATEGORIES from "../data/categories.js";
import * as storage from "./storage.js";
import { fetchDeckFromOpenAI, loadApiKey } from "./openai.js";

const MIN_DECK_SIZE = 20;
const MIN_PLAYABLE = 5;

/** @type { HTMLElement[] } */
const screens = [];

const state = {
    categoryName: "",
    /** @type {{ answer: string, taboo_words: string[] }[]} */
    deck: [],
    pointer: 0,
    activeTeam: /** @type { "A" | "B" } */ ( "A" ),
    teamA: 0,
    teamB: 0,
    roundPoints: 0,
    timeLimitSec: 60,
    timeLeft: 60,
    /** @type { ReturnType<typeof setInterval> | null } */
    timerId: null,
    timerPaused: false,
    /** @type { number | null } */
    roundStartedAt: null,
};

const el = {
    setup: /** @type { HTMLElement } */ ( document.getElementById( "screen-setup" )),
    category: /** @type { HTMLElement } */ ( document.getElementById( "screen-category" )),
    loading: /** @type { HTMLElement } */ ( document.getElementById( "screen-loading" )),
    startRound: /** @type { HTMLElement } */ ( document.getElementById( "screen-start-round" )),
    play: /** @type { HTMLElement } */ ( document.getElementById( "screen-play" )),
    pause: /** @type { HTMLElement } */ ( document.getElementById( "screen-pause" )),
    roundEnd: /** @type { HTMLElement } */ ( document.getElementById( "screen-round-end" )),
    timeLimit: /** @type { HTMLSelectElement } */ ( document.getElementById( "time-limit" )),
    customCategories: /** @type { HTMLElement } */ ( document.getElementById( "custom-categories" )),
    includedCategories: /** @type { HTMLElement } */ ( document.getElementById( "included-categories" )),
    loadingMessage: /** @type { HTMLElement } */ ( document.getElementById( "loading-message" )),
    startRoundTeam: /** @type { HTMLElement } */ ( document.getElementById( "start-round-team" )),
    scoreA: /** @type { HTMLElement } */ ( document.getElementById( "score-a" )),
    scoreB: /** @type { HTMLElement } */ ( document.getElementById( "score-b" )),
    timerBox: /** @type { HTMLElement } */ ( document.getElementById( "timer-box" )),
    timerValue: /** @type { HTMLElement } */ ( document.getElementById( "timer-value" )),
    roundPoints: /** @type { HTMLElement } */ ( document.getElementById( "round-points" )),
    playCategory: /** @type { HTMLElement } */ ( document.getElementById( "play-category" )),
    playAnswer: /** @type { HTMLElement } */ ( document.getElementById( "play-answer" )),
    tabooList: /** @type { HTMLElement } */ ( document.getElementById( "taboo-list" )),
    roundEndSummary: /** @type { HTMLElement } */ ( document.getElementById( "round-end-summary" )),
    roundEndTotals: /** @type { HTMLElement } */ ( document.getElementById( "round-end-totals" )),
};

const showScreen = ( active ) => {
    [ el.setup, el.category, el.loading, el.startRound, el.play, el.pause, el.roundEnd ].forEach(( node ) => {
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

const pointsForSeconds = ( seconds ) => {
    if ( seconds <= 3 ) {
        return 10;
    }
    if ( seconds <= 5 ) {
        return 5;
    }
    return 2;
};

const teamLabel = ( team ) => ( team === "A" ? "Team A" : "Team B" );

const syncSettingsToState = () => {
    const t = Number( el.timeLimit.value );
    state.timeLimitSec = Number.isFinite( t ) && t > 0 ? t : 60;
    storage.saveSettings({ catchphraseTimeLimit: state.timeLimitSec });
};

const applySettingsToForm = () => {
    const s = storage.loadSettings();
    el.timeLimit.value = String( s.catchphraseTimeLimit );
};

const stripSeen = ( deck, category ) => {
    const seen = storage.loadSeenAnswers( category );
    return deck.filter(( c ) => !seen.includes( c.answer ));
};

const buildDeckForCategory = async ( category ) => {
    const seen = storage.loadSeenAnswers( category );

    let best = /** @type {{ answer: string, taboo_words: string[] }[]} */ ([]);

    const pre = PRELOADED_CATEGORIES[category];
    if ( Array.isArray( pre )) {
        const stripped = stripSeen( pre, category );
        if ( stripped.length > best.length ) {
            best = stripped;
        }
    }

    const stored = storage.loadStoredDeck( category );
    if ( Array.isArray( stored )) {
        const stripped = stripSeen( stored, category );
        if ( stripped.length > best.length ) {
            best = stripped;
        }
    }

    if ( best.length < MIN_DECK_SIZE ) {
        el.loadingMessage.textContent = "Generating cards with OpenAI…";
        const apiKey = await loadApiKey();
        const fetched = await fetchDeckFromOpenAI( apiKey, category, seen );
        if ( fetched && /** @type { any } */ ( fetched ).error ) {
            throw new Error( /** @type { any } */ ( fetched ).error );
        }
        if ( !Array.isArray( fetched )) {
            throw new Error( "Could not load deck." );
        }
        storage.saveDeck( category, fetched );
        best = stripSeen( fetched, category );
    }

    if ( best.length < MIN_PLAYABLE ) {
        throw new Error( "Not enough cards left for this category. Clear history in storage or pick another category." );
    }

    return shuffle( best );
};

const updateScoreboard = () => {
    el.scoreA.textContent = `Team A: ${state.teamA}`;
    el.scoreB.textContent = `Team B: ${state.teamB}`;
    el.roundPoints.textContent = `This round: ${state.roundPoints}`;
};

const showCurrentCard = () => {
    const card = state.deck[state.pointer];
    if ( !card ) {
        endRound( "Deck finished — round ends." );
        return;
    }
    el.playCategory.textContent = `Category: ${state.categoryName}`;
    el.playAnswer.textContent = card.answer;
    el.tabooList.innerHTML = "";
    card.taboo_words.forEach(( w ) => {
        const li = document.createElement( "li" );
        li.textContent = w;
        el.tabooList.appendChild( li );
    });
    state.roundStartedAt = Date.now();
    el.timerBox.classList.remove( "timer--warn" );
};

const clearTimer = () => {
    if ( state.timerId ) {
        clearInterval( state.timerId );
        state.timerId = null;
    }
};

const startTimer = () => {
    clearTimer();
    state.timeLeft = state.timeLimitSec;
    state.timerPaused = false;
    el.timerValue.textContent = String( state.timeLeft );
    state.timerId = setInterval(() => {
        if ( state.timerPaused ) {
            return;
        }
        state.timeLeft -= 1;
        el.timerValue.textContent = String( state.timeLeft );
        if ( state.timeLeft <= 10 ) {
            el.timerBox.classList.add( "timer--warn" );
        }
        else {
            el.timerBox.classList.remove( "timer--warn" );
        }
        if ( state.timeLeft <= 0 ) {
            clearTimer();
            endRound( "Time’s up!" );
        }
    }, 1000 );
};

const advanceAfterPassOrCorrect = () => {
    state.pointer += 1;
    if ( state.pointer >= state.deck.length ) {
        endRound( "No more cards in this deck — round ends." );
        return;
    }
    showCurrentCard();
};

const onPass = () => {
    const card = state.deck[state.pointer];
    if ( !card ) {
        return;
    }
    storage.saveSeenAnswer( state.categoryName, card.answer );
    advanceAfterPassOrCorrect();
};

const onCorrect = () => {
    const card = state.deck[state.pointer];
    if ( !card ) {
        return;
    }
    const elapsedSec = state.roundStartedAt
        ? ( Date.now() - state.roundStartedAt ) / 1000
        : 5;
    const pts = pointsForSeconds( elapsedSec );
    state.roundPoints += pts;
    storage.saveSeenAnswer( state.categoryName, card.answer );
    updateScoreboard();
    advanceAfterPassOrCorrect();
};

const endRound = ( reason ) => {
    clearTimer();
    state.timerPaused = false;
    if ( state.activeTeam === "A" ) {
        state.teamA += state.roundPoints;
    }
    else {
        state.teamB += state.roundPoints;
    }
    const earned = state.roundPoints;
    const summary = `${reason} ${teamLabel( state.activeTeam )} scored ${earned} point${earned === 1 ? "" : "s"} this round.`;
    el.roundEndSummary.textContent = summary;
    el.roundEndTotals.textContent = `Team A: ${state.teamA}\nTeam B: ${state.teamB}`;
    showScreen( el.roundEnd );
};

const beginCategory = async ( category ) => {
    state.categoryName = category;
    showScreen( el.loading );
    el.loadingMessage.textContent = "Loading deck…";
    try {
        state.deck = await buildDeckForCategory( category );
        state.pointer = 0;
        state.roundPoints = 0;
        state.teamA = 0;
        state.teamB = 0;
        state.activeTeam = "A";
        el.startRoundTeam.textContent = `${teamLabel( state.activeTeam )} — get ready`;
        updateScoreboard();
        showScreen( el.startRound );
    }
    catch ( err ) {
        console.error( err );
        alert( String( err?.message || err ));
        showScreen( el.category );
    }
};

const openPlayScreen = () => {
    state.roundPoints = 0;
    updateScoreboard();
    showScreen( el.play );
    showCurrentCard();
    startTimer();
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

document.getElementById( "btn-start-round" )?.addEventListener( "click", () => {
    syncSettingsToState();
    openPlayScreen();
});

document.getElementById( "btn-start-abort" )?.addEventListener( "click", () => {
    clearTimer();
    state.deck = [];
    state.pointer = 0;
    state.teamA = 0;
    state.teamB = 0;
    state.activeTeam = "A";
    state.roundPoints = 0;
    state.categoryName = "";
    populateCategories();
    showScreen( el.category );
});

document.getElementById( "btn-pass" )?.addEventListener( "click", onPass );

document.getElementById( "btn-correct" )?.addEventListener( "click", onCorrect );

document.getElementById( "btn-pause" )?.addEventListener( "click", () => {
    state.timerPaused = true;
    showScreen( el.pause );
});

document.getElementById( "btn-resume" )?.addEventListener( "click", () => {
    state.timerPaused = false;
    showScreen( el.play );
});

document.getElementById( "btn-end-round" )?.addEventListener( "click", () => {
    clearTimer();
    endRound( "Round ended early." );
});

document.getElementById( "btn-next-team" )?.addEventListener( "click", () => {
    state.activeTeam = state.activeTeam === "A" ? "B" : "A";
    state.roundPoints = 0;
    state.timeLeft = state.timeLimitSec;
    el.startRoundTeam.textContent = `${teamLabel( state.activeTeam )} — get ready`;
    updateScoreboard();
    showScreen( el.startRound );
});

document.getElementById( "btn-new-category" )?.addEventListener( "click", () => {
    clearTimer();
    state.deck = [];
    state.pointer = 0;
    state.teamA = 0;
    state.teamB = 0;
    state.activeTeam = "A";
    state.roundPoints = 0;
    populateCategories();
    showScreen( el.category );
});

el.timeLimit.addEventListener( "change", syncSettingsToState );

applySettingsToForm();
showScreen( el.setup );
