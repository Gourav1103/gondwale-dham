// Search that works across Hindi and English spellings: "kamakhya" finds "कामाख्या",
// and "कोल्हापुर" finds "Kolhapur".
//
// Both sides are turned into a rough sound key: Devanagari is spelled out in Latin
// letters, then the spellings people vary on (aa/a, ee/i, sh/s, w/v, kh/k, double letters,
// the silent "a") are folded away. Two words that sound alike end up with the same key.

const CONSONANTS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n",
  च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m",
  य: "y", र: "r", ल: "l", ळ: "l", व: "v",
  श: "sh", ष: "sh", स: "s", ह: "h",
};

// Consonant + nukta (़). NFC keeps these as two characters.
const NUKTA: Record<string, string> = { क: "k", ख: "kh", ग: "g", ज: "z", ड: "r", ढ: "dh", फ: "f", य: "y" };

const VOWELS: Record<string, string> = {
  अ: "a", आ: "aa", इ: "i", ई: "ee", उ: "u", ऊ: "oo", ऋ: "ri",
  ए: "e", ऐ: "ai", ओ: "o", औ: "au", ऑ: "o",
};

const MATRAS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o",
};

const HALANT = "्";
const NUKTA_SIGN = "़";
const NASAL = new Set(["ं", "ँ"]);

/** Spell Devanagari in Latin letters (ITRANS-like). Other characters pass through lower-cased. */
export function toLatin(input: string): string {
  const s = input.normalize("NFC");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (CONSONANTS[ch]) {
      let latin = CONSONANTS[ch];
      if (s[i + 1] === NUKTA_SIGN) {
        latin = NUKTA[ch] ?? latin;
        i++;
      }
      out += latin;
      const next = s[i + 1];
      if (next === HALANT) i++;
      else if (MATRAS[next]) {
        out += MATRAS[next];
        i++;
      } else out += "a"; // inherent vowel
    } else if (VOWELS[ch]) out += VOWELS[ch];
    else if (MATRAS[ch]) out += MATRAS[ch];
    else if (NASAL.has(ch)) out += "n";
    else if (ch === "ः" || ch === NUKTA_SIGN || ch === HALANT) continue;
    else out += ch.toLowerCase();
  }
  return out;
}

/** Sound key used for matching. Spaces and punctuation are ignored. */
export function soundKey(input: string): string {
  return toLatin(input)
    .replace(/[^a-z]/g, "")
    .replace(/ksh/g, "ks")
    .replace(/chh|ch/g, "c")
    .replace(/sh/g, "s")
    .replace(/ph/g, "f")
    .replace(/x/g, "ks")
    .replace(/q/g, "k")
    .replace(/z/g, "j")
    .replace(/w/g, "v")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/([bcdfgjklmnpqrstvy])h/g, "$1") // kh → k, th → t … (aspiration is often dropped in English)
    .replace(/m(?=[bp])/g, "n") // अंबा = amba = anba
    .replace(/[ae]/g, "") // the vowel people spell most differently (and Hindi's silent "a")
    .replace(/(.)\1+/g, "$1"); // ujjain = ujain
}

/**
 * Sound keys of each word, plus each pair of neighbouring words ("शक्ति पीठ" = "shaktipeeth")
 * when the query is long enough that a hit across the gap is not a coincidence.
 */
function wordKeys(text: string, withPairs: boolean): string[] {
  const words = text.split(/[\s,.;:()\-–—/|]+/).filter(Boolean);
  const keys = words.map(soundKey);
  if (withPairs) for (let i = 0; i < words.length - 1; i++) keys.push(soundKey(words[i] + words[i + 1]));
  return keys;
}

/**
 * Does `query` match `text`, either as typed or by sound?
 * Pass `queryKey = soundKey(query)` when checking many texts.
 */
export function soundMatch(text: string | undefined | null, query: string, queryKey = soundKey(query)): boolean {
  if (!text) return false;
  const plain = query.normalize("NFC").toLowerCase().trim();
  if (plain && text.normalize("NFC").toLowerCase().includes(plain)) return true;
  // Very short keys ("a", "k") would match nearly everything.
  if (queryKey.length < 2) return false;
  // A query of several words may run across words; a single word must sound like (part of) a word.
  if (/\s/.test(plain) && queryKey.length >= 5) return soundKey(text).includes(queryKey);
  return wordKeys(text, queryKey.length >= 5).some((k) => k.includes(queryKey));
}
