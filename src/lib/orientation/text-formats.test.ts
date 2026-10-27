import { describe, expect, it } from "vitest";
import { parseQuiz, parseSlides, quizToText, scormLaunch, slidesToText, youtubeEmbed } from "./text-formats";

describe("slides text", () => {
  it("round-trips", () => {
    const slides = parseSlides("👋 | Welcome\nGlad you are here.\n\nValues\nIntegrity first.\nCustomer at the centre.");
    expect(slides).toEqual([
      { emoji: "👋", title: "Welcome", body: "Glad you are here." },
      { emoji: undefined, title: "Values", body: "Integrity first.\nCustomer at the centre." },
    ]);
    expect(parseSlides(slidesToText(slides))).toEqual(slides);
  });
});

describe("quiz text", () => {
  it("parses the starred answer", () => {
    const { questions, errors } = parseQuiz("What is KYC?\nKeep your cash\n*Know your customer\n\nPick one\n*A\nB");
    expect(errors).toEqual([]);
    expect(questions[0]).toMatchObject({ options: ["Keep your cash", "Know your customer"], answer: 1 });
    expect(parseQuiz(quizToText(questions)).questions).toEqual(questions);
  });
  it("reports missing or duplicate answers", () => {
    expect(parseQuiz("Q\nA\nB").errors[0]).toMatch(/mark the correct/);
    expect(parseQuiz("Q\n*A\n*B").errors[0]).toMatch(/only one/);
    expect(parseQuiz("Q\n*A").errors[0]).toMatch(/two options/);
  });
});

describe("youtubeEmbed", () => {
  it("handles common link shapes", () => {
    expect(youtubeEmbed("https://www.youtube.com/watch?v=abcDEF12345")).toBe("https://www.youtube-nocookie.com/embed/abcDEF12345");
    expect(youtubeEmbed("https://youtu.be/abcDEF12345?t=3")).toBe("https://www.youtube-nocookie.com/embed/abcDEF12345");
    expect(youtubeEmbed("https://example.com/video.mp4")).toBeNull();
  });
});

describe("scormLaunch", () => {
  it("follows the default organization to its resource", () => {
    const xml = `<manifest><organizations default="ORG2">
      <organization identifier="ORG1"><title>One</title><item identifier="i1" identifierref="R1"/></organization>
      <organization identifier="ORG2"><title>Two</title><item identifier="i2" identifierref="R2"/></organization>
    </organizations><resources>
      <resource identifier="R1" type="webcontent" adlcp:scormtype="sco" href="one/index.html"/>
      <resource identifier="R2" type="webcontent" adlcp:scormtype="sco" href="two/start.html"/>
    </resources></manifest>`;
    expect(scormLaunch(xml)?.href).toBe("two/start.html");
  });
  it("falls back to the first resource with an href", () => {
    expect(scormLaunch(`<resources><resource identifier="x" href="index.html"/></resources>`)?.href).toBe("index.html");
    expect(scormLaunch("<manifest/>")).toBeNull();
  });
});
