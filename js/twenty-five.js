import WORDS from "../data/twenty-five-random-words.js";

const BUDGET = 25;
const WORDS_PER_CARD = 5;

const state = {
    teamAName: "Team A",
    teamBName: "Team B",
    roundsPerTeam: 5,
    teamAScore: 0,
    teamBScore: 0,
    currentTeam: /** @type {"A"|"B"} */ ( "A" ),
    teamATurnsPlayed: 0,
    teamBTurnsPlayed: 0,
    /** @type {string[]} */
    wordGroup: [],
    /** @type {boolean[]} */
    guessed: [],
    wordsUsed: 0,
    usedWords: /** @type {Set<string>} */ ( new Set()),
};

const el = {
    setup:     /** @type {HTMLElement} */ ( document.getElementById( "screen-setup" )),
    pass:      /** @type {HTMLElement} */ ( document.getElementById( "screen-pass" )),
    play:      /** @type {HTMLElement} */ ( document.getElementById( "screen-play" )),
    turnEnd:   /** @type {HTMLElement} */ ( document.getElementById( "screen-turn-end" )),
    gameEnd:   /** @type {HTMLElement} */ ( document.getElementById( "screen-game-end" )),
    teamAInput:       /** @type {HTMLInputElement} */ ( document.getElementById( "tf-team-a" )),
    teamBInput:       /** @type {HTMLInputElement} */ ( document.getElementById( "tf-team-b" )),
    roundsSelect:     /** @type {HTMLSelectElement} */ ( document.getElementById( "tf-rounds" )),
    passTeamLabel:    /** @type {HTMLElement} */ ( document.getElementById( "pass-team-label" )),
    scoreA:           /** @type {HTMLElement} */ ( document.getElementById( "tf-score-a" )),
    scoreB:           /** @type {HTMLElement} */ ( document.getElementById( "tf-score-b" )),
    roundMeta:        /** @type {HTMLElement} */ ( document.getElementById( "tf-round-meta" )),
    wordGrid:         /** @type {HTMLElement} */ ( document.getElementById( "tf-word-grid" )),
    budgetBox:        /** @type {HTMLElement} */ ( document.getElementById( "tf-budget-box" )),
    budgetValue:      /** @type {HTMLElement} */ ( document.getElementById( "tf-budget-value" )),
    btnUsedWord:      /** @type {HTMLButtonElement} */ ( document.getElementById( "btn-tf-used-word" )),
    turnSummary:      /** @type {HTMLElement} */ ( document.getElementById( "tf-turn-summary" )),
    turnTotals:       /** @type {HTMLElement} */ ( document.getElementById( "tf-turn-totals" )),
    btnNextTurn:      /** @type {HTMLButtonElement} */ ( document.getElementById( "btn-tf-next-turn" )),
    winnerHeading:    /** @type {HTMLElement} */ ( document.getElementById( "tf-winner-heading" )),
    finalScores:      /** @type {HTMLElement} */ ( document.getElementById( "tf-final-scores" )),
};

const showScreen = ( active ) => {
    [ el.setup, el.pass, el.play, el.turnEnd, el.gameEnd ].forEach(( node ) => {
        node.classList.toggle( "screen--active", node === active );
    });
};

const teamLabel = ( team ) => ( team === "A" ? state.teamAName : state.teamBName );

const updateScoreboard = () => {
    el.scoreA.textContent = `${state.teamAName}: ${state.teamAScore}`;
    el.scoreB.textContent = `${state.teamBName}: ${state.teamBScore}`;
};

const pickWords = () => {
    let available = WORDS.filter(( w ) => !state.usedWords.has( w ));

    if ( available.length < WORDS_PER_CARD ) {
        state.usedWords.clear();
        available = WORDS.slice();
    }

    const picked = [];
    for ( let i = 0; i < WORDS_PER_CARD; i++ ) {
        const j = Math.floor( Math.random() * available.length );
        picked.push( available.splice( j, 1 )[0] );
    }
    picked.forEach(( w ) => state.usedWords.add( w ));
    return picked;
};

const buildWordGrid = () => {
    el.wordGrid.innerHTML = "";
    state.wordGroup.forEach(( word, i ) => {
        const btn = document.createElement( "button" );
        btn.type = "button";
        btn.className = "btn tf-word-chip";
        btn.dataset.index = String( i );
        btn.textContent = word;
        btn.addEventListener( "click", () => onWordTap( i ));
        el.wordGrid.appendChild( btn );
    });
};

const syncWordGrid = () => {
    const chips = /** @type {NodeListOf<HTMLButtonElement>} */ (
        el.wordGrid.querySelectorAll( ".tf-word-chip" )
    );
    chips.forEach(( chip, i ) => {
        const done = state.guessed[i];
        chip.classList.toggle( "tf-word-chip--guessed", done );
        chip.textContent = done ? `✓ ${state.wordGroup[i]}` : state.wordGroup[i];
    });
};

const syncBudget = () => {
    const left = BUDGET - state.wordsUsed;
    el.budgetValue.textContent = String( left );
    el.budgetBox.classList.toggle( "tf-budget-depleted", left <= 0 );
    el.btnUsedWord.disabled = left <= 0;
};

const guessedCount = () => state.guessed.filter( Boolean ).length;

const onWordTap = ( index ) => {
    if ( state.guessed[index] ) {
        return;
    }
    state.guessed[index] = true;
    syncWordGrid();

    if ( guessedCount() === WORDS_PER_CARD ) {
        endTurn();
    }
};

const endTurn = () => {
    const count = guessedCount();
    const wordsLeft = BUDGET - state.wordsUsed;
    const label = teamLabel( state.currentTeam );

    if ( state.currentTeam === "A" ) {
        state.teamAScore += count;
        state.teamATurnsPlayed += 1;
    }
    else {
        state.teamBScore += count;
        state.teamBTurnsPlayed += 1;
    }

    if ( isGameOver()) {
        showGameEnd();
        return;
    }

    const plural = count === 1 ? "word" : "words";
    el.turnSummary.textContent =
        `${label} guessed ${count} of 5 ${plural} — ${wordsLeft} word budget remaining.`;
    el.turnTotals.textContent =
        `${state.teamAName}: ${state.teamAScore}\n${state.teamBName}: ${state.teamBScore}`;

    showScreen( el.turnEnd );
};

const isGameOver = () =>
    state.teamATurnsPlayed >= state.roundsPerTeam &&
    state.teamBTurnsPlayed >= state.roundsPerTeam;

const showGameEnd = () => {
    const a = state.teamAScore;
    const b = state.teamBScore;
    const aName = state.teamAName;
    const bName = state.teamBName;

    if ( a > b ) {
        el.winnerHeading.textContent = `${aName} wins!`;
    }
    else if ( b > a ) {
        el.winnerHeading.textContent = `${bName} wins!`;
    }
    else {
        el.winnerHeading.textContent = "It's a tie!";
    }

    el.finalScores.textContent = `${aName}: ${a}\n${bName}: ${b}`;
    showScreen( el.gameEnd );
};

const startTurn = () => {
    state.wordGroup = pickWords();
    state.guessed = new Array( WORDS_PER_CARD ).fill( false );
    state.wordsUsed = 0;

    const turnNumber = state.currentTeam === "A"
        ? state.teamATurnsPlayed + 1
        : state.teamBTurnsPlayed + 1;

    el.roundMeta.textContent = `Turn ${turnNumber} of ${state.roundsPerTeam} — ${teamLabel( state.currentTeam )}`;
    updateScoreboard();
    buildWordGrid();
    syncBudget();

    el.passTeamLabel.textContent = `${teamLabel( state.currentTeam )}'s turn`;
    showScreen( el.pass );
};

const resetGame = () => {
    state.teamAScore = 0;
    state.teamBScore = 0;
    state.currentTeam = "A";
    state.teamATurnsPlayed = 0;
    state.teamBTurnsPlayed = 0;
    state.usedWords.clear();
};

document.getElementById( "btn-tf-start" )?.addEventListener( "click", () => {
    const rawA = el.teamAInput.value.trim();
    const rawB = el.teamBInput.value.trim();
    state.teamAName = rawA || "Team A";
    state.teamBName = rawB || "Team B";
    state.roundsPerTeam = Number( el.roundsSelect.value ) || 5;
    resetGame();
    startTurn();
});

document.getElementById( "btn-tf-ready" )?.addEventListener( "click", () => {
    showScreen( el.play );
});

document.getElementById( "btn-tf-used-word" )?.addEventListener( "click", () => {
    if ( state.wordsUsed >= BUDGET ) {
        return;
    }
    state.wordsUsed += 1;
    syncBudget();

    if ( state.wordsUsed >= BUDGET ) {
        endTurn();
    }
});

document.getElementById( "btn-tf-done" )?.addEventListener( "click", endTurn );

document.getElementById( "btn-tf-next-turn" )?.addEventListener( "click", () => {
    state.currentTeam = state.currentTeam === "A" ? "B" : "A";
    startTurn();
});

document.getElementById( "btn-tf-play-again" )?.addEventListener( "click", () => {
    resetGame();
    startTurn();
});

showScreen( el.setup );
