// A small built-in SCORM 1.2 course used when a SCORM module has no uploaded package,
// so the orientation demo works end to end. Original content, written for this portal.

const css = `body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;background:#f5f7f8;color:#13212b}
main{max-width:680px;margin:0 auto;padding:28px 20px}
.card{background:#fff;border:1px solid #e3e8ec;border-radius:14px;padding:24px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
h1{font-size:22px;margin:0 0 6px}.step{font-size:12px;color:#5b6b77;text-transform:uppercase;letter-spacing:.05em}
p,li{line-height:1.6}.tip{background:#e3f3ee;border-radius:10px;padding:12px 14px;margin:14px 0}
a.btn,button{display:inline-block;background:#0e7c66;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-size:14px;text-decoration:none;cursor:pointer}
a.ghost{background:transparent;color:#0e7c66}fieldset{border:1px solid #e3e8ec;border-radius:10px;margin:12px 0;padding:12px}
legend{font-weight:600;padding:0 6px}label{display:block;padding:4px 0}.ok{color:#17794a}.bad{color:#b23a2e}
nav{display:flex;justify-content:space-between;margin-top:20px}`;

const api = `var API=null;function findAPI(w){var n=0;while(w&&!w.API&&w.parent&&w.parent!==w&&n<10){w=w.parent;n++}return w&&w.API?w.API:null}
API=findAPI(window)||(window.opener?findAPI(window.opener):null);
function scorm(fn){try{if(API)return fn(API)}catch(e){}return ""}
scorm(function(a){a.LMSInitialize("")});
function bookmark(loc){scorm(function(a){a.LMSSetValue("cmi.core.lesson_location",loc);if(a.LMSGetValue("cmi.core.lesson_status")==="not attempted")a.LMSSetValue("cmi.core.lesson_status","incomplete");a.LMSCommit("")})}`;

function page(step: string, title: string, body: string, prev: string | null, next: string | null, loc: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${css}</style><script src="scorm.js"></script></head>
<body><main><div class="card"><div class="step">${step}</div><h1>${title}</h1>${body}
<nav>${prev ? `<a class="btn ghost" href="${prev}">← Back</a>` : "<span></span>"}${next ? `<a class="btn" href="${next}">Next →</a>` : ""}</nav>
</div></main><script>bookmark(${JSON.stringify(loc)})</script></body></html>`;
}

const questions = [
  {
    q: "You get an email from 'IT Support' asking you to confirm your password through a link. What do you do?",
    options: ["Click the link and confirm quickly", "Report it as phishing and do not click", "Reply with your password"],
    answer: 1,
  },
  {
    q: "Which is the strongest password?",
    options: ["Abhi2026", "Password@1", "Blue-River-Tea-Lamp-47"],
    answer: 2,
  },
  {
    q: "You find a USB drive in the branch car park. What should you do?",
    options: ["Plug it in to find the owner", "Hand it to IT / Information Security", "Keep it"],
    answer: 1,
  },
];

const testBody = `<p>Answer all three questions. You need 70% to pass.</p><form id="f">
${questions
  .map(
    (q, i) => `<fieldset><legend>${i + 1}. ${q.q}</legend>${q.options
      .map((o, j) => `<label><input type="radio" name="q${i}" value="${j}" required> ${o}</label>`)
      .join("")}</fieldset>`,
  )
  .join("")}
<button type="submit">Submit answers</button></form><p id="result" aria-live="polite"></p>
<script>var KEY=${JSON.stringify(questions.map((q) => q.answer))};
document.getElementById("f").addEventListener("submit",function(e){e.preventDefault();var c=0;
KEY.forEach(function(k,i){var v=document.querySelector('input[name="q'+i+'"]:checked');if(v&&Number(v.value)===k)c++});
var score=Math.round(c/KEY.length*100);var pass=score>=70;
scorm(function(a){a.LMSSetValue("cmi.core.score.min","0");a.LMSSetValue("cmi.core.score.max","100");a.LMSSetValue("cmi.core.score.raw",String(score));
a.LMSSetValue("cmi.core.lesson_status",pass?"passed":"failed");a.LMSCommit("");if(pass)a.LMSFinish("")});
var r=document.getElementById("result");r.className=pass?"ok":"bad";
r.textContent=pass?"Well done! You scored "+score+"%. This module is now complete.":"You scored "+score+"%. Review the pages and try again.";});</script>`;

export const SAMPLE_SCORM_ENTRY = "index.html";

export const SAMPLE_SCORM_FILES: Record<string, string> = {
  "scorm.js": api,
  "index.html": page(
    "Page 1 of 3",
    "Information security at ABHI",
    `<p>Customers trust us with their money and their data. Every colleague protects that trust.</p>
<div class="tip">🔐 Your password is yours alone. IT will never ask for it, by email, phone or chat.</div>
<ul><li>Use a long passphrase: four or more random words with a number.</li><li>Lock your screen (Windows + L) whenever you step away.</li><li>Never share your core-banking or biometric login.</li></ul>`,
    null,
    "phishing.html",
    "index",
  ),
  "phishing.html": page(
    "Page 2 of 3",
    "Spotting phishing",
    `<p>Phishing messages try to rush or scare you into clicking a link or sharing information.</p>
<ul><li>Check the sender's real address, not just the display name.</li><li>Hover over links before clicking. Does the address look right?</li><li>Be wary of urgency: “Your account will be blocked today!”</li><li>Found something odd? Report it to Information Security. Reporting is never wrong.</li></ul>
<div class="tip">💾 Never plug in unknown USB drives. Hand them to IT.</div>`,
    "index.html",
    "test.html",
    "phishing",
  ),
  "test.html": page("Page 3 of 3", "Check your understanding", testBody, "phishing.html", null, "test"),
  "imsmanifest.xml": `<?xml version="1.0"?><manifest identifier="abhi-infosec" version="1.0"><organizations default="org"><organization identifier="org"><title>Information security essentials</title><item identifier="i1" identifierref="r1"><title>Information security</title></item></organization></organizations><resources><resource identifier="r1" type="webcontent" adlcp:scormtype="sco" href="index.html"/></resources></manifest>`,
};
