import PICTURE_REVEAL_WORDS from "../data/picture-reveal-words.js";
import { loadPexelsKey, searchPhotoByQuery } from "./pexels.js";

const LS_KEY = "mg_picture_reveal_v1";
/** 5 clarity steps (0 = hardest, 4 = full). */
const MAX_STAGE = 4;
const STAGE_COUNT = MAX_STAGE + 1;

const state = {
    isPlayer: false,
    /** @type {{ answer: string, query?: string }[]} */
    deck: [],
    pointer: 0,
    secondsPerStage: 5,
    /** @type {ReturnType<typeof setInterval> | null} */
    autoTimer: null,
    /**
     * @type {{
     *   roundId: string
     *   imageUrl: string
     *   answer: string
     *   photographer: string
     *   photographerUrl: string
     *   pageUrl: string
     * } | null}
     */
    currentRound: null,
    currentStage: 0,
    roundIndex: 0,
};

const el = {
    setup: /** @type { HTMLElement } */ ( document.getElementById( "screen-setup" )),
    loading: /** @type { HTMLElement } */ ( document.getElementById( "screen-loading" )),
    playHost: /** @type { HTMLElement } */ ( document.getElementById( "screen-play-host" )),
    playPlayer: /** @type { HTMLElement } */ ( document.getElementById( "screen-play-player" )),
    loadingMessage: /** @type { HTMLElement } */ ( document.getElementById( "pr-loading-message" )),
    btnRetry: /** @type { HTMLButtonElement } */ ( document.getElementById( "btn-pr-retry" )),
    seconds: /** @type { HTMLInputElement } */ ( document.getElementById( "pr-seconds" )),
    hostAnswer: /** @type { HTMLElement } */ ( document.getElementById( "pr-host-answer" )),
    roundMeta: /** @type { HTMLElement } */ ( document.getElementById( "pr-round-meta" )),
    hostImage: /** @type { HTMLImageElement } */ ( document.getElementById( "pr-host-image" )),
    hostFrame: /** @type { HTMLElement } */ ( document.getElementById( "pr-image-frame" )),
    hostOverlay: /** @type { HTMLElement } */ ( document.getElementById( "pr-image-overlay" )),
    stageReadout: /** @type { HTMLElement } */ ( document.getElementById( "pr-stage-readout" )),
    pexelsCredit: /** @type { HTMLElement } */ ( document.getElementById( "pr-pexels-credit" )),
    playerStatus: /** @type { HTMLElement } */ ( document.getElementById( "pr-player-status" )),
    playerImage: /** @type { HTMLImageElement } */ ( document.getElementById( "pr-player-image" )),
    playerFrame: /** @type { HTMLElement } */ ( document.getElementById( "pr-player-image-frame" )),
    playerOverlay: /** @type { HTMLElement } */ ( document.getElementById( "pr-player-overlay" )),
    playerStage: /** @type { HTMLElement } */ ( document.getElementById( "pr-player-stage" )),
    playerPexels: /** @type { HTMLElement } */ ( document.getElementById( "pr-player-pexels" )),
    btnStartHost: /** @type { HTMLButtonElement } */ ( document.getElementById( "btn-pr-start-host" )),
    btnClearer: /** @type { HTMLButtonElement } */ ( document.getElementById( "btn-pr-clearer" )),
    btnFull: /** @type { HTMLButtonElement } */ ( document.getElementById( "btn-pr-full" )),
    btnNextRound: /** @type { HTMLButtonElement } */ ( document.getElementById( "btn-pr-next-round" )),
};

const showScreen = ( active ) => {
    [ el.setup, el.loading, el.playHost, el.playPlayer ].forEach(( node ) => {
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
 * @param { number } stage
 */
const getStageStyle = ( stage ) => {
    const s = Math.min( Math.max( stage, 0 ), MAX_STAGE );
    const progress = s / MAX_STAGE;
    const blur = 20 * ( 1 - progress ) + 0.2;
    const brightness = 0.35 + 0.65 * progress;
    const contrast = 0.55 + 0.45 * progress;
    const saturate = 0.2 + 0.8 * progress;
    return {
        filter: `blur(${ blur.toFixed( 2 ) }px) brightness(${ brightness.toFixed( 2 ) }) contrast(${ contrast.toFixed( 2 ) }) saturate(${ saturate.toFixed( 2 ) })`,
        overlayOpacity: s >= MAX_STAGE ? 0 : 0.55 * ( 1 - progress ) + 0.15,
    };
};

/**
 * @param { HTMLImageElement } img
 * @param { HTMLElement } overlay
 * @param { number } stage
 */
const applyVisualStage = ( img, overlay, stage ) => {
    const { filter, overlayOpacity } = getStageStyle( stage );
    img.style.filter = filter;
    img.style.opacity = "1";
    overlay.style.opacity = String( Math.min( 1, Math.max( 0, overlayOpacity )));
};

/**
 * @param { { answer: string, query?: string } } card
 */
const getSearchQuery = ( card ) => {
    if ( card && typeof card.query === "string" && card.query.trim()) {
        return card.query.trim();
    }
    return card.answer;
};

const clearAutoTimer = () => {
    if ( state.autoTimer ) {
        clearInterval( state.autoTimer );
        state.autoTimer = null;
    }
};

const startAutoTimer = () => {
    clearAutoTimer();
    if ( state.currentStage >= MAX_STAGE ) {
        return;
    }
    const ms = Math.max( 2, state.secondsPerStage ) * 1000;
    state.autoTimer = setInterval(() => {
        if ( state.currentStage < MAX_STAGE ) {
            setStage( state.currentStage + 1 );
        }
        if ( state.currentStage >= MAX_STAGE ) {
            clearAutoTimer();
        }
    }, ms );
};

/**
 * @param { { v: number, roundId: string, imageUrl: string, stage: number, maxStage: number, photographer: string, photographerUrl: string, pageUrl: string } } snap
 */
const writePlayerSnapshot = ( snap ) => {
    try {
        localStorage.setItem( LS_KEY, JSON.stringify( snap ));
    }
    catch {
        // ignore quota / private mode
    }
};

const buildSnapshot = () => {
    if ( !state.currentRound ) {
        return null;
    }
    return {
        v: 1,
        roundId: state.currentRound.roundId,
        imageUrl: state.currentRound.imageUrl,
        stage: state.currentStage,
        maxStage: MAX_STAGE,
        photographer: state.currentRound.photographer,
        photographerUrl: state.currentRound.photographerUrl,
        pageUrl: state.currentRound.pageUrl,
    };
};

const pushSnapshot = () => {
    const s = buildSnapshot();
    if ( s ) {
        writePlayerSnapshot( s );
    }
};

/**
 * @param { number } stage
 */
const setStage = ( stage ) => {
    const next = Math.min( Math.max( stage, 0 ), MAX_STAGE );
    state.currentStage = next;
    if ( el.hostImage && el.hostOverlay ) {
        applyVisualStage( el.hostImage, el.hostOverlay, state.currentStage );
    }
    el.stageReadout.textContent = `Clarity: ${ state.currentStage + 1 } of ${ STAGE_COUNT }`;
    el.btnClearer.disabled = state.currentStage >= MAX_STAGE;
    if ( state.currentStage >= MAX_STAGE ) {
        clearAutoTimer();
    }
    /** Player window syncs from localStorage only; do not put the answer in that payload. */
    pushSnapshot();
};

const setAttribution = () => {
    if ( state.currentRound ) {
        const { photographer, pageUrl, photographerUrl } = state.currentRound;
        if ( !photographer && !pageUrl ) {
            el.pexelsCredit.textContent = "";
        }
        else {
            const link = pageUrl || photographerUrl || "https://www.pexels.com";
            const name = photographer || "Pexels";
            el.pexelsCredit.innerHTML = `Photo: <a href="${ link }" target="_blank" rel="noopener noreferrer">${ name }</a> on Pexels`;
        }
    }
};

let lastPlayerRoundId = "";
let lastPlayerImageUrl = "";

const renderPlayerFromSnapshot = ( raw ) => {
    if ( !raw || raw.v !== 1 || typeof raw.imageUrl !== "string" || !raw.imageUrl ) {
        el.playerStatus.textContent = "Open this page after the host starts a round. Same website address as the host.";
        if ( el.playerFrame ) {
            el.playerFrame.hidden = true;
        }
        el.playerStage.hidden = true;
        return;
    }
    if ( el.playerFrame ) {
        el.playerFrame.hidden = false;
    }
    if ( el.playerStatus ) {
        el.playerStatus.textContent = "Guess the picture. No text hints here.";
    }
    el.playerStage.hidden = false;
    if ( lastPlayerImageUrl !== raw.imageUrl || lastPlayerRoundId !== raw.roundId ) {
        el.playerImage.src = raw.imageUrl;
        el.playerImage.alt = "Mystery picture (guess the subject)";
        lastPlayerImageUrl = raw.imageUrl;
        lastPlayerRoundId = raw.roundId;
    }
    if ( typeof raw.stage === "number" ) {
        state.currentStage = Math.min( Math.max( raw.stage, 0 ), MAX_STAGE );
    }
    applyVisualStage( el.playerImage, el.playerOverlay, state.currentStage );
    el.playerStage.textContent = `Clarity: ${ state.currentStage + 1 } of ${ STAGE_COUNT }`;
    const p = raw.photographer;
    const page = raw.pageUrl;
    if ( p || page ) {
        const link = page || ( typeof raw.photographerUrl === "string" ? raw.photographerUrl : "" ) || "https://www.pexels.com";
        const name = typeof p === "string" && p ? p : "Pexels";
        el.playerPexels.innerHTML = `Photo: <a href="${ link }" target="_blank" rel="noopener noreferrer">${ name }</a> on Pexels`;
    }
    else {
        el.playerPexels.textContent = "";
    }
};

const readLocalSnapshot = () => {
    try {
        const raw = localStorage.getItem( LS_KEY );
        if ( !raw ) {
            return null;
        }
        return /** @type { { v: number, roundId?: string, imageUrl?: string, answer?: string, stage?: number } } */ ( JSON.parse( raw ));
    }
    catch {
        return null;
    }
};

const loadRoundForHost = async ( isRetry = false ) => {
    if ( !isRetry ) {
        el.btnRetry.hidden = true;
    }
    el.loadingMessage.textContent = "Loading photo from Pexels…";
    showScreen( el.loading );
    const card = state.deck[state.pointer];
    if ( !card ) {
        el.loadingMessage.textContent = "No cards in deck.";
        return;
    }
    const key = await loadPexelsKey();
    const query = getSearchQuery( card );
    const res = await searchPhotoByQuery( key, query );
    if ( !res.ok ) {
        el.loadingMessage.textContent = res.error;
        el.btnRetry.hidden = false;
        return;
    }
    const roundId = `r${ Date.now() }`;
    state.currentRound = {
        roundId,
        imageUrl: res.imageUrl,
        answer: card.answer,
        photographer: res.photographer,
        photographerUrl: res.photographerUrl,
        pageUrl: res.pageUrl,
    };
    state.currentStage = 0;
    el.hostAnswer.textContent = card.answer;
    el.hostImage.src = res.imageUrl;
    el.hostImage.decode?.().catch(() => {});
    el.roundIndex += 1;
    el.roundMeta.textContent = `Word ${ state.pointer + 1 } of ${ state.deck.length } · round ${ state.roundIndex }`;
    setStage( 0 );
    setAttribution();
    pushSnapshot();
    showScreen( el.playHost );
    startAutoTimer();
};

const advanceRoundPointer = () => {
    state.pointer = ( state.pointer + 1 ) % state.deck.length;
};

const onHostStart = () => {
    const sec = Number( el.seconds.value );
    state.secondsPerStage = Number.isFinite( sec ) && sec >= 2 && sec <= 60 ? sec : 5;
    if ( PICTURE_REVEAL_WORDS.length < 1 ) {
        return;
    }
    state.deck = shuffle( PICTURE_REVEAL_WORDS.map(( c ) => {
        const out = { answer: c.answer };
        if ( typeof c.query === "string" && c.query.trim()) {
            /** @type { { answer: string, query: string } } */ ( out ).query = c.query.trim();
        }
        return out;
    }));
    state.pointer = 0;
    state.roundIndex = 0;
    void loadRoundForHost( false );
};

const onNextRound = () => {
    clearAutoTimer();
    advanceRoundPointer();
    void loadRoundForHost( false );
};

const initPlayer = () => {
    showScreen( el.playPlayer );
    const apply = () => {
        const snap = readLocalSnapshot();
        if ( !snap || snap.v !== 1 ) {
            renderPlayerFromSnapshot( null );
        }
        else {
            renderPlayerFromSnapshot( snap );
        }
    };
    apply();
    window.addEventListener( "storage", ( e ) => {
        if ( e.key === LS_KEY || e.key === null ) {
            apply();
        }
    });
    setInterval( apply, 2000 );
};

const wireHost = () => {
    el.btnStartHost.addEventListener( "click", onHostStart );
    el.btnRetry.addEventListener( "click", () => {
        void loadRoundForHost( true );
    });
    el.btnClearer.addEventListener( "click", () => {
        if ( state.currentStage < MAX_STAGE ) {
            setStage( state.currentStage + 1 );
        }
        if ( state.currentStage < MAX_STAGE ) {
            startAutoTimer();
        }
    });
    el.btnFull.addEventListener( "click", () => {
        clearAutoTimer();
        setStage( MAX_STAGE );
    });
    el.btnNextRound.addEventListener( "click", onNextRound );
};

const params = new URLSearchParams( window.location.search );
if ( params.get( "player" ) === "1" ) {
    state.isPlayer = true;
    initPlayer();
}
else {
    showScreen( el.setup );
    wireHost();
}