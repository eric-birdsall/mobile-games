/**
 * Default picture-reveal word list. Shape matches password cards: `{ answer }` only.
 * Optional `query` can be added later to override the Pexels search string when the
 * answer is ambiguous (e.g. proper nouns) — v1 uses `answer` as the search query.
 * @type {{ answer: string }[]}
 */
const PICTURE_REVEAL_WORDS = [
    { answer: "elephant" },
    { answer: "giraffe" },
    { answer: "penguin" },
    { answer: "butterfly" },
    { answer: "dolphin" },
    { answer: "tiger" },
    { answer: "panda" },
    { answer: "eagle" },
    { answer: "owl" },
    { answer: "rose" },
    { answer: "sunset" },
    { answer: "beach" },
    { answer: "mountain" },
    { answer: "waterfall" },
    { answer: "forest" },
    { answer: "bridge" },
    { answer: "skyscraper" },
    { answer: "lighthouse" },
    { answer: "castle" },
    { answer: "pizza" },
    { answer: "hamburger" },
    { answer: "coffee" },
    { answer: "bicycle" },
    { answer: "motorcycle" },
    { answer: "airplane" },
    { answer: "guitar" },
    { answer: "piano" },
    { answer: "basketball" },
    { answer: "tennis" },
    { answer: "violin" },
    { answer: "umbrella" },
    { answer: "backpack" },
    { answer: "laptop" },
    { answer: "camera" },
    { answer: "sunglasses" },
    { answer: "cactus" },
    { answer: "bamboo" },
    { answer: "volleyball" },
    { answer: "kayak" },
    { answer: "surfboard" },
    { answer: "snowman" },
];

export default PICTURE_REVEAL_WORDS;
