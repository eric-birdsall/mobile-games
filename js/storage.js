const PREFIX = "mg_v1_";

const KEYS = {
    SEEN_ANSWERS: `${PREFIX}seenAnswers`,
    SEEN_ANSWERS_PASSWORD: `${PREFIX}seenAnswersPassword`,
    CATEGORY_DATA: `${PREFIX}categoryData`,
    CATEGORY_DATA_PASSWORD: `${PREFIX}categoryDataPassword`,
    CUSTOM_CATEGORIES: `${PREFIX}customCategories`,
    SETTINGS: `${PREFIX}settings`,
};

const defaultSettings = () => ({
    catchphraseTimeLimit: 60,
    /** 0 = no target; game ends only when deck runs out or players quit to hub */
    passwordTargetScore: 0,
    /** Optional Password display names; empty string means use default Team A / Team B in UI */
    passwordTeamNameA: "",
    passwordTeamNameB: "",
});

export const loadSettings = () => {
    try {
        const raw = localStorage.getItem( KEYS.SETTINGS );
        if ( !raw ) {
            return defaultSettings();
        }
        const parsed = JSON.parse( raw );
        const time = Number( parsed.catchphraseTimeLimit );
        const target = Number( parsed.passwordTargetScore );
        const rawA = typeof parsed.passwordTeamNameA === "string" ? parsed.passwordTeamNameA.trim() : "";
        const rawB = typeof parsed.passwordTeamNameB === "string" ? parsed.passwordTeamNameB.trim() : "";
        return {
            catchphraseTimeLimit: Number.isFinite( time ) && time > 0 ? time : 60,
            passwordTargetScore:
                Number.isFinite( target ) && target >= 0 ? Math.floor( target ) : 0,
            passwordTeamNameA: rawA.slice( 0, 48 ),
            passwordTeamNameB: rawB.slice( 0, 48 ),
        };
    }
    catch {
        return defaultSettings();
    }
};

export const saveSettings = ( settings ) => {
    const merged = { ...loadSettings(), ...settings };
    localStorage.setItem( KEYS.SETTINGS, JSON.stringify( merged ));
};

export const loadSeenAnswers = ( category ) => {
    try {
        const map = JSON.parse( localStorage.getItem( KEYS.SEEN_ANSWERS )) || {};
        return Array.isArray( map[category] ) ? map[category] : [];
    }
    catch {
        return [];
    }
};

export const saveSeenAnswer = ( category, answer ) => {
    const map = JSON.parse( localStorage.getItem( KEYS.SEEN_ANSWERS )) || {};
    const list = Array.isArray( map[category] ) ? map[category] : [];
    if ( !list.includes( answer )) {
        list.push( answer );
    }
    map[category] = list;
    localStorage.setItem( KEYS.SEEN_ANSWERS, JSON.stringify( map ));
};

export const loadCustomCategories = () => {
    try {
        const list = JSON.parse( localStorage.getItem( KEYS.CUSTOM_CATEGORIES ));
        return Array.isArray( list ) ? list : [];
    }
    catch {
        return [];
    }
};

export const saveCustomCategory = ( category ) => {
    const list = loadCustomCategories();
    if ( !list.includes( category )) {
        list.push( category );
        localStorage.setItem( KEYS.CUSTOM_CATEGORIES, JSON.stringify( list ));
    }
};

export const removeCustomCategory = ( category ) => {
    const list = loadCustomCategories().filter(( c ) => c !== category );
    localStorage.setItem( KEYS.CUSTOM_CATEGORIES, JSON.stringify( list ));
};

export const loadStoredDeck = ( category ) => {
    try {
        const all = JSON.parse( localStorage.getItem( KEYS.CATEGORY_DATA )) || {};
        const deck = all[category];
        return Array.isArray( deck ) ? deck : null;
    }
    catch {
        return null;
    }
};

export const saveDeck = ( category, deck ) => {
    const all = JSON.parse( localStorage.getItem( KEYS.CATEGORY_DATA )) || {};
    all[category] = deck;
    localStorage.setItem( KEYS.CATEGORY_DATA, JSON.stringify( all ));
};

export const loadSeenAnswersPassword = ( category ) => {
    try {
        const map = JSON.parse( localStorage.getItem( KEYS.SEEN_ANSWERS_PASSWORD )) || {};
        return Array.isArray( map[category] ) ? map[category] : [];
    }
    catch {
        return [];
    }
};

export const saveSeenAnswerPassword = ( category, answer ) => {
    const map = JSON.parse( localStorage.getItem( KEYS.SEEN_ANSWERS_PASSWORD )) || {};
    const list = Array.isArray( map[category] ) ? map[category] : [];
    if ( !list.includes( answer )) {
        list.push( answer );
    }
    map[category] = list;
    localStorage.setItem( KEYS.SEEN_ANSWERS_PASSWORD, JSON.stringify( map ));
};

export const loadStoredDeckPassword = ( category ) => {
    try {
        const all = JSON.parse( localStorage.getItem( KEYS.CATEGORY_DATA_PASSWORD )) || {};
        const deck = all[category];
        return Array.isArray( deck ) ? deck : null;
    }
    catch {
        return null;
    }
};

export const saveDeckPassword = ( category, deck ) => {
    const all = JSON.parse( localStorage.getItem( KEYS.CATEGORY_DATA_PASSWORD )) || {};
    all[category] = deck;
    localStorage.setItem( KEYS.CATEGORY_DATA_PASSWORD, JSON.stringify( all ));
};

export const clearCategoryCache = () => {
    localStorage.removeItem( KEYS.CATEGORY_DATA );
    localStorage.removeItem( KEYS.SEEN_ANSWERS );
    localStorage.removeItem( KEYS.CATEGORY_DATA_PASSWORD );
    localStorage.removeItem( KEYS.SEEN_ANSWERS_PASSWORD );
};

export const clearCustomCategories = () => {
    localStorage.removeItem( KEYS.CUSTOM_CATEGORIES );
};
