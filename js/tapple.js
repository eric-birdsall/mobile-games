import TAPPLE_CATEGORIES from "../data/tapple-categories.js";

const LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','R','S','T','W'];
const TIMER_PRESETS = [2, 3, 5, 8, 10];
const MAX_PLAYERS = 8;
const SETTINGS_KEY = "mg_v1_tapple";

const loadSettings = () => {
    try {
        const p = JSON.parse( localStorage.getItem( SETTINGS_KEY ) || "{}" );
        return {
            timerSetting: TIMER_PRESETS.includes( Number( p.timerSetting ) ) ? Number( p.timerSetting ) : 5,
            mode: ["free", "alpha", "random"].includes( p.mode ) ? p.mode : "free",
            anxietyMode: Boolean( p.anxietyMode ),
        };
    }
    catch { return { timerSetting: 5, mode: "free", anxietyMode: false }; }
};

const saveSettings = ( s ) => localStorage.setItem( SETTINGS_KEY, JSON.stringify( s ) );

const state = {
    /** @type {{ name: string, eliminated: boolean, eliminatedRound: number | null }[]} */
    players: [],
    activePlayers: /** @type {number[]} */ ([]),
    currentIdx: 0,
    mode: "free",
    category: "",
    timerSetting: 5,
    anxietyMode: false,
    currentTimer: 5,
    timeLeft: 5,
    /** @type {ReturnType<typeof setInterval> | null} */
    timerId: null,
    roundNumber: 1,
    /** @type {{ name: string, round: number }[]} */
    eliminatedLog: [],
    usedLetters: new Set(),
    /** @type {string[]} */
    letterSequence: [],
    letterPos: 0,
    turnsThisRotation: 0,
    /** @type {string[]} */
    customCategories: [],
};

const el = {
    screenPlayers:       /** @type {HTMLElement} */ ( document.getElementById( "screen-players" ) ),
    screenSettings:      /** @type {HTMLElement} */ ( document.getElementById( "screen-settings" ) ),
    screenCategory:      /** @type {HTMLElement} */ ( document.getElementById( "screen-category" ) ),
    screenPlay:          /** @type {HTMLElement} */ ( document.getElementById( "screen-play" ) ),
    screenBetweenRounds: /** @type {HTMLElement} */ ( document.getElementById( "screen-between-rounds" ) ),
    screenAllSurvive:    /** @type {HTMLElement} */ ( document.getElementById( "screen-all-survive" ) ),
    screenGameOver:      /** @type {HTMLElement} */ ( document.getElementById( "screen-game-over" ) ),
    playerInputs:        /** @type {HTMLElement} */ ( document.getElementById( "player-inputs" ) ),
    btnAddPlayer:        /** @type {HTMLButtonElement} */ ( document.getElementById( "btn-add-player" ) ),
    timerSelect:         /** @type {HTMLSelectElement} */ ( document.getElementById( "timer-select" ) ),
    anxietyToggle:       /** @type {HTMLInputElement} */ ( document.getElementById( "anxiety-toggle" ) ),
    includedCategories:  /** @type {HTMLElement} */ ( document.getElementById( "included-categories" ) ),
    customCategoriesEl:  /** @type {HTMLElement} */ ( document.getElementById( "custom-categories" ) ),
    playPlayerName:      /** @type {HTMLElement} */ ( document.getElementById( "play-player-name" ) ),
    playCategoryLabel:   /** @type {HTMLElement} */ ( document.getElementById( "play-category-label" ) ),
    tappleTimerBox:      /** @type {HTMLElement} */ ( document.getElementById( "tapple-timer-box" ) ),
    tappleTimerValue:    /** @type {HTMLElement} */ ( document.getElementById( "tapple-timer-value" ) ),
    anxietyLabel:        /** @type {HTMLElement} */ ( document.getElementById( "anxiety-label" ) ),
    letterGrid:          /** @type {HTMLElement} */ ( document.getElementById( "letter-grid" ) ),
    singleLetterView:    /** @type {HTMLElement} */ ( document.getElementById( "single-letter-view" ) ),
    currentLetter:       /** @type {HTMLElement} */ ( document.getElementById( "current-letter" ) ),
    btnGotIt:            /** @type {HTMLButtonElement} */ ( document.getElementById( "btn-got-it" ) ),
    eliminatedMsg:       /** @type {HTMLElement} */ ( document.getElementById( "eliminated-msg" ) ),
    roundLabel:          /** @type {HTMLElement} */ ( document.getElementById( "round-label" ) ),
    remainingList:       /** @type {HTMLElement} */ ( document.getElementById( "remaining-list" ) ),
    eliminatedList:      /** @type {HTMLElement} */ ( document.getElementById( "eliminated-list" ) ),
    btnStartNextRound:   /** @type {HTMLButtonElement} */ ( document.getElementById( "btn-start-next-round" ) ),
    btnSurviveAction:    /** @type {HTMLButtonElement} */ ( document.getElementById( "btn-survive-action" ) ),
    winnerName:          /** @type {HTMLElement} */ ( document.getElementById( "winner-name" ) ),
    eliminationOrder:    /** @type {HTMLElement} */ ( document.getElementById( "elimination-order" ) ),
    btnPlayAgain:        /** @type {HTMLButtonElement} */ ( document.getElementById( "btn-play-again" ) ),
    btnNewGame:          /** @type {HTMLButtonElement} */ ( document.getElementById( "btn-new-game" ) ),
};

const allScreens = [
    el.screenPlayers, el.screenSettings, el.screenCategory,
    el.screenPlay, el.screenBetweenRounds, el.screenAllSurvive, el.screenGameOver,
];

const showScreen = ( active ) => {
    allScreens.forEach( ( s ) => s.classList.toggle( "screen--active", s === active ) );
};

const shuffle = ( arr ) => {
    const a = arr.slice();
    for ( let i = a.length - 1; i > 0; i-- ) {
        const j = Math.floor( Math.random() * ( i + 1 ) );
        [ a[i], a[j] ] = [ a[j], a[i] ];
    }
    return a;
};

const ordinal = ( n ) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + ( s[( v - 20 ) % 10] || s[v] || s[0] );
};

// ---- Players Screen ----

const initPlayers = () => {
    state.players = [
        { name: "Player 1", eliminated: false, eliminatedRound: null },
        { name: "Player 2", eliminated: false, eliminatedRound: null },
    ];
};

const renderPlayerInputs = () => {
    el.playerInputs.innerHTML = "";
    state.players.forEach( ( p, i ) => {
        const defaultName = `Player ${i + 1}`;
        const row = document.createElement( "div" );
        row.className = "player-input-row";

        const input = document.createElement( "input" );
        input.type = "text";
        input.className = "field-control";
        input.placeholder = defaultName;
        input.value = p.name === defaultName ? "" : p.name;
        input.maxLength = 24;
        input.addEventListener( "input", () => {
            state.players[i].name = input.value.trim() || defaultName;
        });
        row.appendChild( input );

        if ( state.players.length > 1 ) {
            const rm = document.createElement( "button" );
            rm.type = "button";
            rm.className = "btn btn-ghost btn-small tapple-remove-btn";
            rm.textContent = "✕";
            rm.addEventListener( "click", () => {
                state.players.splice( i, 1 );
                renderPlayerInputs();
            });
            row.appendChild( rm );
        }

        el.playerInputs.appendChild( row );
    });
    el.btnAddPlayer.disabled = state.players.length >= MAX_PLAYERS;
};

el.btnAddPlayer.addEventListener( "click", () => {
    if ( state.players.length >= MAX_PLAYERS ) return;
    state.players.push({ name: `Player ${state.players.length + 1}`, eliminated: false, eliminatedRound: null });
    renderPlayerInputs();
});

document.getElementById( "btn-players-continue" )?.addEventListener( "click", () => {
    const saved = loadSettings();
    el.timerSelect.value = String( saved.timerSetting );
    el.anxietyToggle.checked = saved.anxietyMode;
    const modeInput = /** @type {HTMLInputElement | null} */ (
        document.querySelector( `input[name="tapple-mode"][value="${saved.mode}"]` )
    );
    if ( modeInput ) modeInput.checked = true;
    showScreen( el.screenSettings );
});

// ---- Settings Screen ----

document.getElementById( "btn-settings-back" )?.addEventListener( "click", () => showScreen( el.screenPlayers ) );

document.getElementById( "btn-settings-continue" )?.addEventListener( "click", () => {
    const checkedMode = /** @type {HTMLInputElement | null} */ (
        document.querySelector( "input[name=\"tapple-mode\"]:checked" )
    );
    state.mode = checkedMode ? checkedMode.value : "free";
    state.timerSetting = Number( el.timerSelect.value ) || 5;
    state.anxietyMode = el.anxietyToggle.checked;
    saveSettings({ mode: state.mode, timerSetting: state.timerSetting, anxietyMode: state.anxietyMode });
    populateCategories();
    showScreen( el.screenCategory );
});

// ---- Category Screen ----

const populateCategories = () => {
    el.includedCategories.innerHTML = "";
    TAPPLE_CATEGORIES.forEach( ( cat ) => {
        const btn = document.createElement( "button" );
        btn.type = "button";
        btn.className = "category-chip";
        btn.textContent = cat;
        btn.addEventListener( "click", () => beginGame( cat ) );
        el.includedCategories.appendChild( btn );
    });

    el.customCategoriesEl.innerHTML = "";
    state.customCategories.forEach( ( cat ) => {
        const btn = document.createElement( "button" );
        btn.type = "button";
        btn.className = "category-chip";
        btn.textContent = cat;
        btn.addEventListener( "click", () => beginGame( cat ) );
        el.customCategoriesEl.appendChild( btn );
    });
};

document.getElementById( "btn-category-back" )?.addEventListener( "click", () => showScreen( el.screenSettings ) );

document.getElementById( "btn-add-custom-category" )?.addEventListener( "click", () => {
    const name = window.prompt( "Enter a custom category:" );
    if ( !name?.trim() ) return;
    const trimmed = name.trim();
    if ( !state.customCategories.includes( trimmed ) ) state.customCategories.push( trimmed );
    populateCategories();
    beginGame( trimmed );
});

// ---- Game Initialization ----

const beginGame = ( category ) => {
    state.category = category;
    state.roundNumber = 1;
    state.eliminatedLog = [];
    state.currentTimer = state.timerSetting;
    state.turnsThisRotation = 0;
    state.players.forEach( ( p ) => { p.eliminated = false; p.eliminatedRound = null; });
    state.activePlayers = state.players.map( ( _, i ) => i );
    state.currentIdx = 0;
    startRound();
};

// ---- Round Setup ----

const startRound = () => {
    state.turnsThisRotation = 0;
    if ( state.mode === "free" ) {
        state.usedLetters = new Set();
        buildLetterGrid();
        el.letterGrid.style.display = "";
        el.singleLetterView.style.display = "none";
    }
    else {
        if ( state.mode === "alpha" ) {
            const startIdx = Math.floor( Math.random() * LETTERS.length );
            state.letterSequence = LETTERS.map( ( _, i ) => LETTERS[( startIdx + i ) % LETTERS.length] );
        }
        else {
            state.letterSequence = shuffle( LETTERS );
        }
        state.letterPos = 0;
        el.letterGrid.style.display = "none";
        el.singleLetterView.style.display = "";
    }
    showScreen( el.screenPlay );
    startTurn();
};

// ---- Letter Grid (Mode: free) ----

const buildLetterGrid = () => {
    el.letterGrid.innerHTML = "";
    LETTERS.forEach( ( letter ) => {
        const btn = document.createElement( "button" );
        btn.type = "button";
        btn.className = "letter-btn";
        btn.textContent = letter;
        btn.dataset.letter = letter;
        if ( state.usedLetters.has( letter ) ) {
            btn.classList.add( "letter-btn--used" );
            btn.disabled = true;
        }
        btn.addEventListener( "click", () => onLetterTap( letter ) );
        el.letterGrid.appendChild( btn );
    });
};

// ---- Turn ----

const startTurn = () => {
    const player = state.players[state.activePlayers[state.currentIdx]];
    el.playPlayerName.textContent = player.name;
    el.playCategoryLabel.textContent = `Category: ${state.category}`;

    if ( state.mode !== "free" ) {
        el.currentLetter.textContent = state.letterSequence[state.letterPos];
    }

    if ( state.anxietyMode ) {
        el.anxietyLabel.textContent = `Anxiety — ${state.currentTimer}s`;
        el.anxietyLabel.style.display = "";
    }
    else {
        el.anxietyLabel.style.display = "none";
    }

    startTimer();
};

// ---- Timer ----

const clearTimer = () => {
    if ( state.timerId !== null ) {
        clearInterval( state.timerId );
        state.timerId = null;
    }
};

const startTimer = () => {
    clearTimer();
    state.timeLeft = state.currentTimer;
    el.tappleTimerValue.textContent = String( state.timeLeft );
    el.tappleTimerBox.classList.remove( "timer--warn" );

    state.timerId = setInterval( () => {
        state.timeLeft -= 1;
        el.tappleTimerValue.textContent = String( state.timeLeft );
        if ( state.timeLeft / state.currentTimer <= 0.4 ) {
            el.tappleTimerBox.classList.add( "timer--warn" );
        }
        if ( state.timeLeft <= 0 ) {
            clearTimer();
            eliminateCurrentPlayer();
        }
    }, 1000 );
};

// ---- Anxiety / Rotation Tracking ----

const checkRotation = ( countBefore ) => {
    if ( !state.anxietyMode ) return;
    state.turnsThisRotation += 1;
    if ( state.turnsThisRotation >= countBefore ) {
        state.turnsThisRotation = 0;
        const idx = TIMER_PRESETS.indexOf( state.currentTimer );
        if ( idx > 0 ) state.currentTimer = TIMER_PRESETS[idx - 1];
    }
};

// ---- Elimination ----

const eliminateCurrentPlayer = () => {
    const countBefore = state.activePlayers.length;
    checkRotation( countBefore );

    const playerIdx = state.activePlayers[state.currentIdx];
    const player = state.players[playerIdx];
    player.eliminated = true;
    player.eliminatedRound = state.roundNumber;
    state.eliminatedLog.push({ name: player.name, round: state.roundNumber });
    state.activePlayers.splice( state.currentIdx, 1 );

    if ( state.currentIdx >= state.activePlayers.length ) state.currentIdx = 0;

    if ( state.activePlayers.length <= 1 ) {
        showGameOver();
        return;
    }
    showBetweenRounds( player.name );
};

// ---- Mode free: Letter Tap ----

const onLetterTap = ( letter ) => {
    if ( state.usedLetters.has( letter ) ) return;
    clearTimer();

    const countBefore = state.activePlayers.length;
    checkRotation( countBefore );

    state.usedLetters.add( letter );
    const btn = /** @type {HTMLButtonElement | null} */ (
        el.letterGrid.querySelector( `[data-letter="${letter}"]` )
    );
    if ( btn ) { btn.classList.add( "letter-btn--used" ); btn.disabled = true; }

    if ( state.usedLetters.size >= LETTERS.length ) {
        everyoneSurvives();
        return;
    }
    advancePlayer();
    startTurn();
};

// ---- Modes alpha/random: Got It ----

const onGotIt = () => {
    clearTimer();

    const countBefore = state.activePlayers.length;
    checkRotation( countBefore );

    state.letterPos += 1;
    if ( state.letterPos >= LETTERS.length ) {
        everyoneSurvives();
        return;
    }
    advancePlayer();
    startTurn();
};

el.btnGotIt.addEventListener( "click", onGotIt );

// ---- Advance Player ----

const advancePlayer = () => {
    state.currentIdx = ( state.currentIdx + 1 ) % state.activePlayers.length;
};

// ---- Everyone Survives ----

const everyoneSurvives = () => {
    if ( state.mode === "free" ) {
        el.btnSurviveAction.textContent = "Pick new category";
        el.btnSurviveAction.onclick = () => { populateCategories(); showScreen( el.screenCategory ); };
    }
    else {
        state.roundNumber += 1;
        el.btnSurviveAction.textContent = `Start Round ${state.roundNumber}`;
        el.btnSurviveAction.onclick = () => startRound();
    }
    showScreen( el.screenAllSurvive );
};

// ---- Between Rounds ----

const showBetweenRounds = ( eliminatedName ) => {
    el.eliminatedMsg.textContent = `${eliminatedName} has been eliminated!`;
    el.roundLabel.textContent = `Round ${state.roundNumber} — ${state.activePlayers.length} player${state.activePlayers.length !== 1 ? "s" : ""} remaining`;

    el.remainingList.innerHTML = "";
    state.activePlayers.forEach( ( idx ) => {
        const li = document.createElement( "li" );
        li.textContent = state.players[idx].name;
        el.remainingList.appendChild( li );
    });

    el.eliminatedList.innerHTML = "";
    state.eliminatedLog.forEach( ( { name, round } ) => {
        const li = document.createElement( "li" );
        li.textContent = `${name} (round ${round})`;
        el.eliminatedList.appendChild( li );
    });

    el.btnStartNextRound.textContent = `Start Round ${state.roundNumber + 1}`;
    showScreen( el.screenBetweenRounds );
};

el.btnStartNextRound.addEventListener( "click", () => {
    state.roundNumber += 1;
    startRound();
});

// ---- Game Over ----

const showGameOver = () => {
    const winner = state.activePlayers.length === 1
        ? state.players[state.activePlayers[0]]
        : null;
    el.winnerName.textContent = winner ? `${winner.name} wins!` : "Game over!";

    el.eliminationOrder.innerHTML = "";
    state.eliminatedLog.forEach( ( { name, round }, i ) => {
        const li = document.createElement( "li" );
        li.textContent = `${ordinal( i + 1 )} out: ${name} (round ${round})`;
        el.eliminationOrder.appendChild( li );
    });

    showScreen( el.screenGameOver );
};

el.btnPlayAgain.addEventListener( "click", () => {
    state.players.forEach( ( p ) => { p.eliminated = false; p.eliminatedRound = null; });
    state.eliminatedLog = [];
    state.currentTimer = state.timerSetting;
    populateCategories();
    showScreen( el.screenCategory );
});

el.btnNewGame.addEventListener( "click", () => {
    initPlayers();
    renderPlayerInputs();
    showScreen( el.screenPlayers );
});

// ---- Init ----
initPlayers();
renderPlayerInputs();
showScreen( el.screenPlayers );
