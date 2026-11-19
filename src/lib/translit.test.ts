import { describe, expect, it } from "vitest";
import { soundKey, soundMatch, toLatin } from "./translit";

describe("toLatin", () => {
  it("spells Devanagari with the inherent vowel and matras", () => {
    expect(toLatin("कामाख्या")).toBe("kaamaakhyaa");
    expect(toLatin("शक्तिपीठ")).toBe("shaktipeetha");
    expect(toLatin("कांगड़ा")).toBe("kaangaraa");
  });
});

describe("soundMatch: English query finds Hindi names", () => {
  const cases: [string, string][] = [
    ["kamakhya", "कामाख्या शक्तिपीठ"],
    ["jwalamukhi", "ज्वालामुखी शक्तिपीठ"],
    ["hinglaj", "हिंगलाज, बलूचिस्तान, पाकिस्तान"],
    ["hingula", "हिंगुला शक्तिपीठ"],
    ["kolhapur", "कोल्हापुर, महाराष्ट्र, भारत"],
    ["ujjain", "उज्जैन, मध्य प्रदेश, भारत"],
    ["kalighat", "कालीघाट शक्तिपीठ"],
    ["varanasi", "मणिकर्णिका घाट, वाराणसी"],
    ["vrindavan", "वृंदावन शक्तिपीठ"],
    ["kurukshetra", "कुरुक्षेत्र शक्तिपीठ"],
    ["guwahati", "नीलांचल पर्वत, गुवाहाटी, असम"],
    ["assam", "गुवाहाटी, असम, भारत"],
    ["kashmir", "कश्मीर शक्तिपीठ"],
    ["shakti peeth", "विराट शक्तिपीठ"],
    ["shaktipith", "विराट शक्तिपीठ"],
    ["naina devi", "श्री नैना देवी"],
    ["chintpurni", "श्री माता चिंतपूर्णी मंदिर"],
    ["tripura sundari", "त्रिपुरा सुंदरी शक्तिपीठ"],
    ["sri lanka", "श्रीलंका"],
    ["shri", "श्री महाकाली माताजी"],
    ["bengal", "पश्चिम बंगाल, भारत"],
    ["kangra", "कांगड़ा, हिमाचल प्रदेश"],
    ["pavagadh", "गुजरात, पावागढ़"],
    ["Nepal", "काठमांडू, नेपाल"],
    ["vaidyanath", "वैद्यनाथ शक्तिपीठ"],
    ["mahamaya", "महामाया शक्ति पीठ"],
    ["kanyakumari", "तमिल नाड़ु के कन्याकुमारी में"],
  ];
  it.each(cases)("%s → %s", (q, text) => expect(soundMatch(text, q)).toBe(true));
});

describe("soundMatch: Hindi query finds English text", () => {
  it.each([
    ["कोल्हापुर", "Kolhapur temple"],
    ["कामाख्या", "Kamakhya Devi"],
    ["ज्वालामुखी", "Jwalamukhi, Kangra"],
  ])("%s → %s", (q, text) => expect(soundMatch(text, q)).toBe(true));
});

describe("soundMatch: no false hits", () => {
  it("different places don't match", () => {
    expect(soundMatch("कामाख्या शक्तिपीठ", "kolhapur")).toBe(false);
    expect(soundMatch("हिंगुला शक्तिपीठ", "nepal")).toBe(false);
    expect(soundMatch("उज्जैन", "jalandhar")).toBe(false);
  });
  it("ignores keys too short to mean anything", () => {
    expect(soundKey("a")).toBe("");
    expect(soundMatch("कामाख्या", "a")).toBe(false);
  });
  it("still matches plain text as typed", () => {
    expect(soundMatch("हिंगुला शक्तिपीठ", "हिंगु")).toBe(true);
    expect(soundMatch(undefined, "x")).toBe(false);
  });
});
