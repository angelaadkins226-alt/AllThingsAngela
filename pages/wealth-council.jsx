const { useState, useRef, useEffect } = React;

// Uses this design tool's built-in Claude helper while you're working here.
// After you deploy the Cloudflare Worker proxy (see launch/README.md), paste
// its URL below and the site will use that automatically once live.
const CLAUDE_PROXY_URL = ""; // e.g. "https://claude-proxy.yoursubdomain.workers.dev"

async function callClaude(opts) {
  if (window.claude && window.claude.complete) {
    return await window.claude.complete(opts);
  }
  if (!CLAUDE_PROXY_URL) {
    throw new Error("Claude proxy not configured yet — set CLAUDE_PROXY_URL after deploying your Worker.");
  }
  const res = await fetch(CLAUDE_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`Proxy request failed (${res.status})`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.text;
}

// ── The Council ─────────────────────────────────────────────
// Ten wealth-building archetypes, drawn from how each operator
// actually built and compounded their fortune.
const COUNCIL = [
  {
    id: "musk",
    name: "Elon Musk",
    domain: "Tesla · SpaceX · xAI",
    lens: "First-principles bets on civilizational-scale problems; vertical integration; tolerance for catastrophic risk in pursuit of asymmetric upside.",
    principle: "Reason from physics, not analogy. If the problem is big enough, the market will be too.",
  },
  {
    id: "page",
    name: "Larry Page",
    domain: "Google · Alphabet",
    lens: "10x thinking over 10% thinking; build moats from network effects and proprietary technology; let cash-cow fund moonshots.",
    principle: "Solve a problem 10x better than anyone and distribution compounds on its own.",
  },
  {
    id: "brin",
    name: "Sergey Brin",
    domain: "Google · Alphabet",
    lens: "Research-driven product; obsess over the core algorithm/engine before monetization; technical depth as durable edge.",
    principle: "Get the engine right first. Revenue is a consequence of a genuinely better product.",
  },
  {
    id: "bezos",
    name: "Jeff Bezos",
    domain: "Amazon · Blue Origin",
    lens: "Customer obsession; long time-horizon; reinvest margins into a flywheel; Day 1 mentality; decide with 70% of the information.",
    principle: "Work backward from the customer. Be stubborn on vision, flexible on details.",
  },
  {
    id: "ellison",
    name: "Larry Ellison",
    domain: "Oracle",
    lens: "Own the infrastructure others depend on; aggressive sales culture; acquire to consolidate; recurring enterprise revenue.",
    principle: "Sell the thing businesses can't operate without, then make leaving expensive.",
  },
  {
    id: "zuckerberg",
    name: "Mark Zuckerberg",
    domain: "Meta",
    lens: "Move fast; capture network effects early; control distribution; reinvest aggressively into the next platform before forced to.",
    principle: "The real risk is moving too slow. Own the network and the network defends you.",
  },
  {
    id: "huang",
    name: "Jensen Huang",
    domain: "Nvidia",
    lens: "Bet a decade early on a platform shift; build the picks-and-shovels for a whole industry; suffer through the lean years.",
    principle: "Position years before the wave. Sell the infrastructure every winner will need.",
  },
  {
    id: "arnault",
    name: "Bernard Arnault",
    domain: "LVMH",
    lens: "Brand as a multi-generational asset; scarcity and desire over volume; acquire and elevate; protect pricing power above all.",
    principle: "Build assets that appreciate with time and story, not ones that depreciate with use.",
  },
  {
    id: "ballmer",
    name: "Steve Ballmer",
    domain: "Microsoft",
    lens: "Operational discipline; ride a dominant franchise; concentrate ownership in one compounding asset; energy and execution.",
    principle: "A single great asset, held and operated relentlessly, beats a hundred clever bets.",
  },
  {
    id: "dell",
    name: "Michael Dell",
    domain: "Dell Technologies",
    lens: "Cut out the middleman; build direct-to-customer; obsess over operations and capital efficiency; reinvent the model when it stalls.",
    principle: "Remove every intermediary between you and the customer, and keep the cash cycle tight.",
  },
  {
    id: "counsel",
    name: "The Dealmaker's Counsel",
    domain: "Business & Real Estate Law",
    lens: "A lawyer-operator's mindset modeled on attorneys who became dealmakers: analytical, detail-obsessed, and acutely aware of risk — but who uses legal structure to GET deals done, not just to spot what could go wrong. Thinks in entities, contracts, liability, financing structures, zoning and regulatory navigation, and clean exits.",
    principle: "Structure is leverage. The deal is won or lost in how it's papered, owned, and exited — not just the price.",
  },
];

const SUGGESTIONS = [
  "I have an idea but no money to start. What now?",
  "How do I know if my business is worth scaling?",
  "Should I take on a co-founder or stay solo?",
  "How do these minds think about risk differently than I do?",
];

function buildSystemPrompt(selected) {
  const members = selected.length
    ? COUNCIL.filter((c) => selected.includes(c.id))
    : COUNCIL;
  const roster = members
    .map(
      (m) =>
        `- ${m.name} (${m.domain}). Lens: ${m.lens} Core principle: "${m.principle}"`
    )
    .join("\n");

  return `You are THE COUNCIL — a single advisory intelligence that channels the wealth-building and business-building mindsets of these operators:

${roster}

Your job is to help the user think and act like these minds do when building a business and creating wealth. You are not a cheerleader and not a generic business coach. You give the kind of sharp, specific, occasionally uncomfortable counsel these people would actually give.

HOW TO RESPOND:
1. Lead with the single most important insight, stated plainly. No throat-clearing.
2. Where the council members would genuinely disagree, surface the tension — e.g. Bezos's long horizon vs. Dell's cash-cycle discipline, Musk's catastrophic-risk tolerance vs. Arnault's patient brand-building. Name who thinks what. Disagreement is more useful than false consensus.
3. Be concrete and actionable. Push toward a decision, an experiment, or a next move — never vague encouragement.
4. Apply the mental models explicitly when useful: first-principles reasoning, 10x thinking, working backward from the customer, flywheels, moats, picks-and-shovels positioning, owning distribution, removing intermediaries, pricing power.
5. Keep it tight. A few punchy paragraphs. Use a short list only when genuinely enumerating options or steps.
6. You are advisory only — not a financial advisor. Don't give individualized investment or legal advice; frame wealth-building as strategy and mindset.

Speak as one voice, but let the distinct philosophies show through.`;
}

// Verdict mode: each member returns a structured ruling as JSON.
function buildVerdictPrompt(selected) {
  const members = selected.length
    ? COUNCIL.filter((c) => selected.includes(c.id))
    : COUNCIL;
  const roster = members
    .map((m) => `- ${m.id} = ${m.name} (${m.domain}). Lens: ${m.lens}`)
    .join("\n");

  return `You are THE COUNCIL. The user will present ONE concrete decision. Each council member below renders an independent verdict through their own documented operating philosophy:

${roster}

Return ONLY valid JSON — no markdown, no backticks, no preamble. Exact shape:

{
  "summary": "1-2 sentence read on the real crux of this decision",
  "verdicts": [
    {
      "id": "<member id exactly as listed above>",
      "call": "PROCEED" | "PROCEED WITH CHANGES" | "HOLD" | "PASS",
      "reasoning": "2-3 sentences in that member's authentic voice and logic. Be specific to THIS decision, not generic.",
      "risk": "the single sharpest risk or blind spot this member would flag"
    }
  ],
  "alternatives": [
    {
      "move": "a specific adjacent move the council WOULD back — a reframe, a smaller version, a sequenced first step, or a different structure that captures most of the upside while addressing the main objection",
      "rationale": "1-2 sentences on why this is stronger than the original, and which council member's thinking it draws on",
      "championedBy": "<member id of the member whose philosophy most supports this alternative>"
    }
  ],
  "consensus": "where the council lands overall, including the strongest dissent and the one move that would most de-risk the decision"
}

Include one verdict object for every member listed, using their exact id. Calls should genuinely vary — these minds do not agree.

If "The Dealmaker's Counsel" is among the members, that voice focuses on legal structure, entity choice, liability, contracts, financing terms, zoning/regulatory exposure, and exit mechanics — framed as general educational considerations a sharp business/real-estate attorney would raise, NOT as legal advice for the user's specific situation. It should explicitly note when something warrants review by a licensed attorney in the user's jurisdiction.

ALWAYS provide 2-3 alternatives, and make them genuinely useful especially when the council leans HOLD or PASS — never leave the user at a dead end. Alternatives should be concrete and adjacent to the original idea (a smaller first step, a different structure, a reframe, a way to test cheaply), not generic advice. Be concrete, decisive, and unsentimental. This is strategy and mindset, not individualized financial or legal advice.`;
}

const PRESET_DECISIONS = [
  {
    label: "StoryMind: stop building, start distributing",
    text: "Should I freeze new feature development on StoryMind (currently v8.7) and spend the next 90 days purely on distribution and conversion — getting real SLPs and educators using and paying — instead of building more features?",
  },
  {
    label: "Hagerstown triplex house-hack",
    text: "Should I use NACA financing to buy the Hagerstown triplex (616 W Franklin St) as an owner-occupied house-hack, living in one unit and renting the other two, as a low-effort lever toward early retirement at 45?",
  },
  {
    label: "StoryMind pricing: which tier to push",
    text: "StoryMind has three tiers (Single Story / Educator / School & District). Should I focus go-to-market on landing individual SLP/educator subscriptions for recurring revenue, or chase larger school & district deals despite the longer sales cycle?",
  },
];


function WealthCouncil() {
  const [mode, setMode] = useState("chat"); // "chat" | "verdict"
  const [selected, setSelected] = useState([]); // empty = full council
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [verdict, setVerdict] = useState(null); // structured verdict result
  const [exported, setExported] = useState(null); // export feedback state
  const [saved, setSaved] = useState([]); // saved verdict history
  const [viewingSaved, setViewingSaved] = useState(false);
  const [savedChats, setSavedChats] = useState([]); // saved counsel conversations
  const [viewingChats, setViewingChats] = useState(false);
  const [chatExported, setChatExported] = useState(null); // chat export feedback
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setError(null);
    setInput("");

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const apiMessages = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = (
        await callClaude({
          model: "claude-sonnet-4-5",
          max_tokens: 1000,
          system: buildSystemPrompt(selected),
          messages: apiMessages,
        })
      ).trim();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply || "…" },
      ]);
    } catch (err) {
      setError("The council went quiet. Try sending that again.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(content);
    } finally {
      setLoading(false);
    }
  };

  const requestVerdict = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setError(null);
    setInput("");
    setVerdict({ decision: content, summary: null, verdicts: [], consensus: null });
    setLoading(true);

    try {
      const raw = (
        await callClaude({
          model: "claude-sonnet-4-5",
          max_tokens: 4000,
          system: buildVerdictPrompt(selected),
          messages: [{ role: "user", content }],
        })
      ).trim();

      if (!raw) {
        throw new Error("The council returned an empty response. Try again.");
      }

      const parsed = parseVerdictJSON(raw);
      if (!parsed || !Array.isArray(parsed.verdicts) || parsed.verdicts.length === 0) {
        throw new Error("The verdict came back incomplete. Try rephrasing the decision a bit more specifically.");
      }
      setVerdict({ decision: content, ...parsed });
    } catch (err) {
      setError(err.message || "Couldn't assemble a clean verdict. Try again.");
      setVerdict(null);
      setInput(content);
    } finally {
      setLoading(false);
    }
  };

  const submit = (text) =>
    mode === "verdict" ? requestVerdict(text) : send(text);

  const saveVerdict = () => {
    if (!verdict || !verdict.verdicts || verdict.verdicts.length === 0) return;
    // Avoid duplicate saves of the same decision.
    setSaved((prev) => {
      const exists = prev.some((v) => v.decision === verdict.decision);
      if (exists) return prev;
      const entry = {
        ...verdict,
        savedAt: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      };
      return [entry, ...prev];
    });
  };

  const restoreVerdict = (entry) => {
    setVerdict(entry);
    setViewingSaved(false);
    setMode("verdict");
  };

  const startNewVerdict = () => {
    setVerdict(null);
    setViewingSaved(false);
    setInput("");
    setError(null);
    setExported(null);
    setMode("verdict");
  };

  const newChat = () => {
    setMessages([]);
    setViewingChats(false);
    setInput("");
    setError(null);
    setMode("chat");
  };

  const saveChat = () => {
    if (!messages.length) return;
    // Title from the first user message.
    const firstUser = messages.find((m) => m.role === "user");
    const title = firstUser
      ? firstUser.content.slice(0, 70)
      : "Conversation";
    setSavedChats((prev) => {
      const entry = {
        title,
        messages: [...messages],
        voices: activeNames,
        savedAt: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        id: Date.now(),
      };
      return [entry, ...prev];
    });
  };

  const restoreChat = (entry) => {
    setMessages(entry.messages);
    setViewingChats(false);
    setMode("chat");
  };

  const removeChat = (id) => {
    setSavedChats((prev) => prev.filter((c) => c.id !== id));
  };

  const removeSaved = (decision) => {
    setSaved((prev) => prev.filter((v) => v.decision !== decision));
  };

  const isSaved =
    verdict && saved.some((v) => v.decision === verdict.decision);

  const activeNames =
    selected.length === 0
      ? "Full council"
      : COUNCIL.filter((c) => selected.includes(c.id))
          .map((c) => c.name.split(" ")[1] || c.name)
          .join(", ");

  return (
    <div style={S.app}>
      <style>{KEYFRAMES}</style>

      {/* Roster rail */}
      <aside style={S.rail}>
        <div style={S.brandBlock}>
          <div style={S.brandMark}>◆</div>
          <div>
            <div style={S.brandName}>THE COUNCIL</div>
            <div style={S.brandSub}>Eleven minds. One advisory voice.</div>
          </div>
        </div>

        <div style={S.railHint}>
          {selected.length === 0 ? (
            "Tap to convene specific minds — or leave all dimmed to consult the full council."
          ) : (
            <span>
              <strong style={{ color: goldSoft }}>
                {selected.length} selected.
              </strong>{" "}
              Only these voices will weigh in.{" "}
              <span
                style={S.clearSel}
                onClick={() => setSelected([])}
              >
                Clear
              </span>
            </span>
          )}
        </div>

        <div style={S.roster}>
          {COUNCIL.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                style={{
                  ...S.member,
                  ...(on ? S.memberOn : {}),
                }}
              >
                <div style={S.memberTop}>
                  <span style={S.memberName}>{c.name}</span>
                  <span style={{ ...S.dot, ...(on ? S.dotOn : {}) }} />
                </div>
                <span style={S.memberDomain}>{c.domain}</span>
                <span style={S.memberPrinciple}>"{c.principle}"</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Conversation */}
      <main style={S.main}>
        <header style={S.header}>
          <div style={S.headerLeft}>
            <div style={S.headerTitle}>In session</div>
            <div style={S.headerActive}>{activeNames}</div>
          </div>
          <div style={S.modeToggle}>
            <button
              style={{
                ...S.modeBtn,
                ...(mode === "chat" && !viewingChats ? S.modeBtnOn : {}),
              }}
              onClick={() => {
                setMode("chat");
                setViewingSaved(false);
                setViewingChats(false);
              }}
            >
              Counsel
            </button>
            <button
              style={{
                ...S.modeBtn,
                ...(mode === "verdict" && !viewingSaved ? S.modeBtnOn : {}),
              }}
              onClick={() => {
                setMode("verdict");
                setViewingSaved(false);
                setViewingChats(false);
              }}
            >
              Verdict
            </button>
            {savedChats.length > 0 && (
              <button
                style={{
                  ...S.modeBtn,
                  ...(mode === "chat" && viewingChats ? S.modeBtnOn : {}),
                }}
                onClick={() => {
                  setMode("chat");
                  setViewingChats(true);
                  setViewingSaved(false);
                }}
              >
                ★ Chats ({savedChats.length})
              </button>
            )}
            {saved.length > 0 && (
              <button
                style={{
                  ...S.modeBtn,
                  ...(viewingSaved ? S.modeBtnOn : {}),
                }}
                onClick={() => {
                  setMode("verdict");
                  setViewingSaved(true);
                  setViewingChats(false);
                }}
              >
                ★ Verdicts ({saved.length})
              </button>
            )}
          </div>
        </header>

        <div style={S.scroll} ref={scrollRef}>
          {/* SAVED VERDICTS LIST */}
          {mode === "verdict" && viewingSaved && (
            <div style={S.verdictWrap}>
              <div style={S.savedHeader}>Saved verdicts</div>
              {saved.length === 0 && (
                <div style={S.emptyP}>Nothing saved yet.</div>
              )}
              {saved.map((entry, i) => {
                const passCount = (entry.verdicts || []).filter((v) =>
                  (v.call || "").toUpperCase().includes("PASS")
                ).length;
                const proceedCount = (entry.verdicts || []).filter((v) =>
                  (v.call || "").toUpperCase().includes("PROCEED")
                ).length;
                return (
                  <div key={i} style={S.savedCard}>
                    <div
                      style={S.savedCardMain}
                      onClick={() => restoreVerdict(entry)}
                    >
                      <div style={S.savedDecision}>{entry.decision}</div>
                      <div style={S.savedMeta}>
                        <span>{entry.savedAt}</span>
                        <span style={S.savedTally}>
                          {proceedCount} lean yes · {passCount} pass
                        </span>
                      </div>
                    </div>
                    <button
                      style={S.savedRemove}
                      onClick={() => removeSaved(entry.decision)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* VERDICT MODE */}
          {mode === "verdict" && !viewingSaved && (
            <>
              {!verdict && !loading && (
                <div style={S.empty}>
                  <div style={S.emptyMark}>⚖</div>
                  <h1 style={S.emptyH}>
                    Put one decision before the council.
                    <br />
                    Get a ruling from every mind.
                  </h1>
                  <p style={S.emptyP}>
                    Each member returns a call — proceed, change, hold, or pass —
                    with their reasoning and the one risk they'd flag. Then the
                    council lands a consensus.
                  </p>
                  {selected.length > 0 && (
                    <div style={S.activePill}>
                      Ruling from only: {activeNames}
                    </div>
                  )}
                  <div style={S.suggestions}>
                    {PRESET_DECISIONS.map((d) => (
                      <button
                        key={d.label}
                        style={S.chip}
                        onClick={() => requestVerdict(d.text)}
                      >
                        ⚖ {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {verdict && (
                <div style={S.verdictWrap}>
                  <div style={S.newVerdictRow}>
                    <button style={S.newVerdictBtn} onClick={startNewVerdict}>
                      + New verdict
                    </button>
                  </div>
                  <div style={S.verdictDecision}>
                    <span style={S.verdictLabel}>Decision under review</span>
                    {verdict.decision}
                  </div>

                  {verdict.summary && (
                    <div style={S.verdictSummary}>{verdict.summary}</div>
                  )}

                  <div style={S.verdictGrid}>
                    {verdict.verdicts &&
                      verdict.verdicts.map((v) => {
                        const member = COUNCIL.find((c) => c.id === v.id);
                        if (!member) return null;
                        return (
                          <div key={v.id} style={S.vCard}>
                            <div style={S.vCardHead}>
                              <span style={S.vCardName}>{member.name}</span>
                              <span
                                style={{
                                  ...S.callBadge,
                                  ...callStyle(v.call),
                                }}
                              >
                                {v.call}
                              </span>
                            </div>
                            <div style={S.vReasoning}>{v.reasoning}</div>
                            <div style={S.vRisk}>
                              <span style={S.vRiskLabel}>RISK</span>
                              {v.risk}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {verdict.consensus && (
                    <div style={S.consensus}>
                      <div style={S.consensusLabel}>The council lands</div>
                      {verdict.consensus}
                    </div>
                  )}

                  {verdict.alternatives && verdict.alternatives.length > 0 && (
                    <div style={S.altWrap}>
                      <div style={S.altHeader}>
                        Adjacent moves the council would back
                      </div>
                      {verdict.alternatives.map((alt, idx) => {
                        const champ = COUNCIL.find(
                          (c) => c.id === alt.championedBy
                        );
                        return (
                          <div key={idx} style={S.altCard}>
                            <div style={S.altNum}>{idx + 1}</div>
                            <div style={S.altBody}>
                              <div style={S.altMove}>{alt.move}</div>
                              <div style={S.altRationale}>
                                {alt.rationale}
                                {champ && (
                                  <span style={S.altChamp}>
                                    {" "}
                                    — {champ.name.split(" ")[1] || champ.name}'s
                                    lens
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {verdict.verdicts && verdict.verdicts.length > 0 && (
                    <div style={S.exportRow}>
                      <button
                        style={{
                          ...S.exportBtn,
                          ...(isSaved ? S.savedBtnOn : {}),
                        }}
                        onClick={saveVerdict}
                        disabled={isSaved}
                      >
                        {isSaved ? "✓ Saved" : "★ Save this verdict"}
                      </button>
                      <button
                        style={S.exportBtn}
                        onClick={() => {
                          const ok = exportBrief(verdict, activeNames);
                          setExported(ok ? "done" : "fail");
                          setTimeout(() => setExported(null), 3500);
                        }}
                      >
                        {exported === "done"
                          ? "✓ Brief downloaded"
                          : exported === "fail"
                          ? "Export failed — try again"
                          : "↓ Export one-page brief"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* SAVED CHATS LIST */}
          {mode === "chat" && viewingChats && (
            <div style={S.verdictWrap}>
              <div style={S.savedHeader}>Saved conversations</div>
              {savedChats.length === 0 && (
                <div style={S.emptyP}>Nothing saved yet.</div>
              )}
              {savedChats.map((entry) => (
                <div key={entry.id} style={S.savedCard}>
                  <div
                    style={S.savedCardMain}
                    onClick={() => restoreChat(entry)}
                  >
                    <div style={S.savedDecision}>{entry.title}</div>
                    <div style={S.savedMeta}>
                      <span>{entry.savedAt}</span>
                      <span style={S.savedTally}>
                        {entry.messages.length} messages · {entry.voices}
                      </span>
                    </div>
                  </div>
                  <button
                    style={S.savedRemove}
                    onClick={() => exportChat(entry.messages, entry.voices)}
                    title="Export transcript"
                  >
                    ↓
                  </button>
                  <button
                    style={S.savedRemove}
                    onClick={() => removeChat(entry.id)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* CHAT MODE */}
          {mode === "chat" && !viewingChats && messages.length === 0 && (
            <div style={S.empty}>
              <div style={S.emptyMark}>◆</div>
              <h1 style={S.emptyH}>
                Bring a business problem.
                <br />
                Hear how the council would solve it.
              </h1>
              <p style={S.emptyP}>
                The council reasons from first principles, surfaces where its
                members disagree, and pushes you toward a move — not a pep talk.
              </p>
              {selected.length > 0 && (
                <div style={S.activePill}>
                  Consulting only: {activeNames}
                </div>
              )}
              <div style={S.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} style={S.chip} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "chat" && !viewingChats && messages.length > 0 && (
            <div style={S.chatActions}>
              <button style={S.chatActionBtn} onClick={newChat}>
                + New conversation
              </button>
              <button style={S.chatActionBtn} onClick={saveChat}>
                ★ Save conversation
              </button>
              <button
                style={S.chatActionBtn}
                onClick={() => {
                  const ok = exportChat(messages, activeNames);
                  setChatExported(ok ? "done" : "fail");
                  setTimeout(() => setChatExported(null), 3500);
                }}
              >
                {chatExported === "done"
                  ? "✓ Downloaded"
                  : chatExported === "fail"
                  ? "Export failed"
                  : "↓ Export transcript"}
              </button>
            </div>
          )}

          {mode === "chat" &&
            !viewingChats &&
            messages.map((m, i) => (
              <div
                key={i}
                style={{
                  ...S.row,
                  justifyContent:
                    m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {m.role === "assistant" && <div style={S.avatar}>◆</div>}
                <div
                  style={{
                    ...S.bubble,
                    ...(m.role === "user" ? S.userBubble : S.botBubble),
                  }}
                >
                  {renderText(m.content)}
                </div>
              </div>
            ))}

          {loading && !viewingChats && !viewingSaved && (
            <div style={S.row}>
              <div style={S.avatar}>◆</div>
              <div style={{ ...S.bubble, ...S.botBubble }}>
                <span style={S.thinking}>
                  {mode === "verdict"
                    ? "The council is ruling"
                    : "The council is deliberating"}
                </span>
                <span style={S.ellipsis}>
                  {[0, 1, 2].map((n) => (
                    <span
                      key={n}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: gold,
                        display: "inline-block",
                        animation: `blink 1.2s ${n * 0.18}s infinite ease-in-out`,
                      }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}

          {error && <div style={S.error}>{error}</div>}
        </div>

        {!viewingChats && !viewingSaved && (
          <div style={S.composer}>
            <textarea
              style={S.input}
              placeholder={
                mode === "verdict"
                  ? "State one decision for the council to rule on…"
                  : "Describe your business problem or wealth-building question…"
              }
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button
              style={{
                ...S.sendBtn,
                ...(input.trim() && !loading ? {} : S.sendBtnOff),
              }}
              onClick={() => submit()}
              disabled={!input.trim() || loading}
            >
              {mode === "verdict" ? "Rule →" : "Convene →"}
            </button>
          </div>
        )}
        <div style={S.disclaimer}>
          Strategy, mindset, and general education — not individualized
          financial, investment, or legal advice. Consult a licensed
          professional in your jurisdiction before acting.
        </div>
      </main>
    </div>
  );
}

// Color a verdict badge by its call.
function callStyle(call) {
  const c = (call || "").toUpperCase();
  if (c.includes("PROCEED") && !c.includes("CHANGE"))
    return { background: "rgba(95,175,115,0.16)", color: "#7BD49A", borderColor: "rgba(95,175,115,0.4)" };
  if (c.includes("CHANGE"))
    return { background: "rgba(201,162,75,0.16)", color: "#E5C572", borderColor: "rgba(201,162,75,0.4)" };
  if (c.includes("HOLD"))
    return { background: "rgba(120,140,200,0.16)", color: "#9AAAE0", borderColor: "rgba(120,140,200,0.4)" };
  return { background: "rgba(210,120,110,0.16)", color: "#E8978A", borderColor: "rgba(210,120,110,0.4)" };
}

// Robustly extract a JSON object from the model's reply, even if it's
// wrapped in ```json fences or has stray prose before/after it.
function parseVerdictJSON(raw) {
  let text = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  // First try straight parse.
  try {
    return JSON.parse(text);
  } catch (_) {
    // Fall through to brace extraction.
  }

  // Find the outermost {...} block by matching balanced braces.
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch (_) {
          return null;
        }
      }
    }
  }
  return null;
}

// Generate a standalone printable HTML brief and open it in a new tab.
function exportBrief(verdict, activeNames) {
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const badgeColor = (call) => {
    const c = (call || "").toUpperCase();
    if (c.includes("PROCEED") && !c.includes("CHANGE")) return "#2f8a4f";
    if (c.includes("CHANGE")) return "#b8902f";
    if (c.includes("HOLD")) return "#5566b0";
    return "#c25548";
  };

  const rows = (verdict.verdicts || [])
    .map((v) => {
      const m = COUNCIL.find((c) => c.id === v.id);
      const name = m ? m.name : v.id;
      const domain = m ? m.domain : "";
      return `
      <tr>
        <td class="who"><strong>${esc(name)}</strong><span class="dom">${esc(domain)}</span></td>
        <td><span class="badge" style="background:${badgeColor(v.call)}">${esc(v.call)}</span></td>
        <td class="reason">${esc(v.reasoning)}<div class="risk"><span>RISK</span> ${esc(v.risk)}</div></td>
      </tr>`;
    })
    .join("");

  const altRows = (verdict.alternatives || [])
    .map((alt, i) => {
      const champ = COUNCIL.find((c) => c.id === alt.championedBy);
      const champName = champ ? champ.name.split(" ")[1] || champ.name : "";
      return `
      <div class="alt">
        <div class="altn">${i + 1}</div>
        <div><div class="altm">${esc(alt.move)}</div><div class="altr">${esc(alt.rationale)}${champName ? ` <em>— ${esc(champName)}'s lens</em>` : ""}</div></div>
      </div>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Council Brief</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1c22; max-width: 820px; margin: 0 auto; padding: 48px 40px; line-height: 1.55; }
  .top { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid #c9a24b; padding-bottom:12px; margin-bottom:26px; }
  .brand { font-size:13px; letter-spacing:3px; text-transform:uppercase; color:#9a7d2f; font-weight:bold; }
  .date { font-size:12px; color:#777; font-family:Arial,sans-serif; }
  h1 { font-size:23px; margin:0 0 6px; }
  .decision { background:#faf7ef; border-left:3px solid #c9a24b; padding:14px 16px; font-size:16px; margin-bottom:18px; }
  .label { display:block; font-family:Arial,sans-serif; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:#9a7d2f; font-weight:bold; margin-bottom:6px; }
  .summary { font-style:italic; color:#444; margin-bottom:24px; padding-bottom:18px; border-bottom:1px solid #e2ddd0; }
  table { width:100%; border-collapse:collapse; margin-bottom:26px; }
  td { vertical-align:top; padding:11px 10px; border-bottom:1px solid #ece8dd; font-size:13.5px; font-family:Arial,sans-serif; }
  .who { width:150px; } .who strong { display:block; font-size:14px; } .dom { font-size:10px; color:#888; text-transform:uppercase; letter-spacing:.4px; }
  .badge { color:#fff; font-family:Arial,sans-serif; font-size:9.5px; font-weight:bold; letter-spacing:.5px; padding:3px 8px; border-radius:4px; white-space:nowrap; }
  .reason { color:#2c2e35; }
  .risk { margin-top:7px; font-size:11.5px; color:#777; border-top:1px dashed #ddd; padding-top:6px; }
  .risk span { color:#c25548; font-weight:bold; font-size:9px; letter-spacing:1px; }
  .consensus { background:#faf7ef; border:1px solid #e3cf9a; border-radius:8px; padding:16px 18px; font-size:14.5px; }
  .alt { display:flex; gap:11px; align-items:flex-start; padding:11px 0; border-bottom:1px solid #ece8dd; }
  .altn { min-width:22px; height:22px; background:#c9a24b; color:#1a1c22; border-radius:5px; display:flex; align-items:center; justify-content:center; font-family:Arial,sans-serif; font-weight:bold; font-size:12px; }
  .altm { font-weight:bold; font-size:14px; margin-bottom:3px; }
  .altr { font-size:12.5px; color:#555; font-family:Arial,sans-serif; line-height:1.5; }
  .altr em { color:#9a7d2f; }
  .foot { margin-top:30px; font-family:Arial,sans-serif; font-size:10px; color:#aaa; text-align:center; }
  @media print { body { padding:24px; } .noprint { display:none; } }
  .noprint { text-align:center; margin-bottom:24px; }
  .pbtn { font-family:Arial,sans-serif; background:#c9a24b; color:#1a1c22; border:none; padding:10px 22px; border-radius:7px; font-weight:bold; font-size:13px; cursor:pointer; }
</style></head>
<body>
  <div class="noprint"><button class="pbtn" onclick="window.print()">Print or save as PDF</button></div>
  <div class="top"><span class="brand">◆ The Council — Decision Brief</span><span class="date">${esc(date)}</span></div>
  <div class="decision"><span class="label">Decision under review</span>${esc(verdict.decision)}</div>
  ${verdict.summary ? `<div class="summary">${esc(verdict.summary)}</div>` : ""}
  <span class="label">Individual rulings &nbsp;·&nbsp; ${esc(activeNames)}</span>
  <table><tbody>${rows}</tbody></table>
  ${verdict.consensus ? `<div class="consensus"><span class="label">The council lands</span>${esc(verdict.consensus)}</div>` : ""}
  ${altRows ? `<div style="margin-top:24px"><span class="label">Adjacent moves the council would back</span>${altRows}</div>` : ""}
  <div class="foot">Generated by The Council · Strategy and mindset, not individualized financial or legal advice.</div>
</body></html>`;

  // Download as a standalone .html file — reliable inside the sandbox.
  // The file opens in any browser, prints, and saves as PDF on its own.
  try {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (verdict.decision || "decision")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    a.download = `council-brief-${slug || "decision"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (err) {
    return false;
  }
}

// Export a Counsel conversation as a standalone printable transcript.
function exportChat(messages, activeNames) {
  if (!messages || messages.length === 0) return false;
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Light formatting: paragraphs and **bold** within each turn.
  const fmt = (text) =>
    esc(text)
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map(
        (l) =>
          `<p>${l.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</p>`
      )
      .join("");

  const turns = messages
    .map((m) => {
      if (m.role === "user") {
        return `<div class="turn user"><div class="who">You asked</div><div class="msg">${fmt(
          m.content
        )}</div></div>`;
      }
      return `<div class="turn council"><div class="who">◆ The Council</div><div class="msg">${fmt(
        m.content
      )}</div></div>`;
    })
    .join("");

  const firstUser = messages.find((m) => m.role === "user");
  const heading = firstUser ? firstUser.content.slice(0, 90) : "Conversation";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Council Conversation</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1c22; max-width: 760px; margin: 0 auto; padding: 48px 40px; line-height: 1.6; }
  .top { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid #c9a24b; padding-bottom:12px; margin-bottom:22px; }
  .brand { font-size:13px; letter-spacing:3px; text-transform:uppercase; color:#9a7d2f; font-weight:bold; }
  .date { font-size:12px; color:#777; font-family:Arial,sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; line-height:1.3; }
  .sub { font-family:Arial,sans-serif; font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px; margin-bottom:26px; }
  .turn { margin-bottom:20px; }
  .who { font-family:Arial,sans-serif; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; font-weight:bold; margin-bottom:6px; }
  .user .who { color:#9a7d2f; }
  .council .who { color:#1a1c22; }
  .user .msg { background:#faf7ef; border-left:3px solid #c9a24b; padding:10px 14px; border-radius:4px; }
  .council .msg { padding:0 2px; }
  .msg p { margin:0 0 9px; font-size:14px; }
  .foot { margin-top:30px; font-family:Arial,sans-serif; font-size:10px; color:#aaa; text-align:center; border-top:1px solid #eee; padding-top:14px; }
  @media print { body { padding:24px; } .noprint { display:none; } }
  .noprint { text-align:center; margin-bottom:24px; }
  .pbtn { font-family:Arial,sans-serif; background:#c9a24b; color:#1a1c22; border:none; padding:10px 22px; border-radius:7px; font-weight:bold; font-size:13px; cursor:pointer; }
</style></head>
<body>
  <div class="noprint"><button class="pbtn" onclick="window.print()">Print or save as PDF</button></div>
  <div class="top"><span class="brand">◆ The Council — Conversation</span><span class="date">${esc(
    date
  )}</span></div>
  <h1>${esc(heading)}</h1>
  <div class="sub">Voices: ${esc(activeNames)}</div>
  ${turns}
  <div class="foot">Generated by The Council · Strategy, mindset, and general education — not individualized financial, investment, or legal advice.</div>
</body></html>`;

  try {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    a.download = `council-conversation-${slug || "chat"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (err) {
    return false;
  }
}

function renderText(text) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  return lines.map((line, i) => {
    const bulletMatch = line.match(/^\s*[-*•]\s+(.*)/);
    const numMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
    if (bulletMatch) {
      return (
        <div key={i} style={S.li}>
          <span style={S.liDot}>—</span>
          <span>{inline(bulletMatch[1])}</span>
        </div>
      );
    }
    if (numMatch) {
      return (
        <div key={i} style={S.li}>
          <span style={S.liNum}>{numMatch[1]}</span>
          <span>{inline(numMatch[2])}</span>
        </div>
      );
    }
    return (
      <p key={i} style={S.para}>
        {inline(line)}
      </p>
    );
  });
}

function inline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} style={{ color: "#F4E4C1", fontWeight: 600 }}>
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

// ── Styling ─────────────────────────────────────────────────
const ink = "#0E0F13";
const panel = "#15171D";
const gold = "#C9A24B";
const goldSoft = "#F4E4C1";
const line = "#262932";
const dim = "#7E8494";

const S = {
  app: {
    display: "flex",
    height: "100vh",
    background: ink,
    color: "#E8E9ED",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflow: "hidden",
  },
  rail: {
    width: 320,
    minWidth: 320,
    background: panel,
    borderRight: `1px solid ${line}`,
    display: "flex",
    flexDirection: "column",
    padding: "26px 20px",
    overflowY: "auto",
  },
  brandBlock: { display: "flex", alignItems: "center", gap: 12, marginBottom: 22 },
  brandMark: {
    width: 38,
    height: 38,
    display: "grid",
    placeItems: "center",
    color: ink,
    background: `linear-gradient(135deg, ${gold}, ${goldSoft})`,
    borderRadius: 9,
    fontSize: 18,
  },
  brandName: {
    fontFamily: "'Georgia', serif",
    fontSize: 17,
    letterSpacing: 2,
    fontWeight: 600,
    color: goldSoft,
  },
  brandSub: { fontSize: 11.5, color: dim, marginTop: 2 },
  railHint: {
    fontSize: 12,
    lineHeight: 1.5,
    color: dim,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: `1px solid ${line}`,
  },
  clearSel: {
    color: gold,
    cursor: "pointer",
    textDecoration: "underline",
    fontWeight: 600,
  },
  activePill: {
    display: "inline-block",
    background: "rgba(201,162,75,0.12)",
    border: `1px solid rgba(201,162,75,0.35)`,
    color: goldSoft,
    fontSize: 12.5,
    fontWeight: 600,
    padding: "7px 15px",
    borderRadius: 20,
    marginBottom: 22,
  },
  roster: { display: "flex", flexDirection: "column", gap: 8 },
  member: {
    textAlign: "left",
    background: "transparent",
    border: `1px solid ${line}`,
    borderRadius: 11,
    padding: "11px 13px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    transition: "all .18s ease",
    color: "inherit",
  },
  memberOn: {
    borderColor: gold,
    background: "rgba(201,162,75,0.08)",
  },
  memberTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberName: { fontSize: 14, fontWeight: 600, color: "#EFF0F3" },
  memberDomain: {
    fontSize: 11,
    color: dim,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  memberPrinciple: {
    fontSize: 11.5,
    color: "#A6ABBA",
    fontStyle: "italic",
    lineHeight: 1.45,
    marginTop: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    border: `1px solid ${dim}`,
    transition: "all .18s ease",
  },
  dotOn: { background: gold, borderColor: gold, boxShadow: `0 0 8px ${gold}` },

  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  header: {
    padding: "16px 28px",
    borderBottom: `1px solid ${line}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    background: "rgba(21,23,29,0.6)",
    backdropFilter: "blur(8px)",
  },
  headerLeft: { display: "flex", flexDirection: "column", gap: 2 },
  modeToggle: {
    display: "flex",
    background: ink,
    border: `1px solid ${line}`,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    border: "none",
    background: "transparent",
    color: dim,
    fontSize: 12.5,
    fontWeight: 600,
    padding: "7px 16px",
    borderRadius: 7,
    cursor: "pointer",
    transition: "all .16s ease",
    fontFamily: "inherit",
  },
  modeBtnOn: {
    background: `linear-gradient(135deg, ${gold}, ${goldSoft})`,
    color: ink,
  },
  headerTitle: {
    fontSize: 10.5,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: dim,
  },
  headerActive: { fontSize: 14.5, fontWeight: 600, color: goldSoft },

  scroll: { flex: 1, overflowY: "auto", padding: "28px 28px 8px" },

  empty: {
    maxWidth: 560,
    margin: "6vh auto 0",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  emptyMark: {
    fontSize: 30,
    color: gold,
    marginBottom: 18,
    animation: "pulse 3s ease-in-out infinite",
  },
  emptyH: {
    fontFamily: "'Georgia', serif",
    fontSize: 27,
    lineHeight: 1.25,
    fontWeight: 600,
    margin: 0,
    color: "#F2F3F6",
  },
  emptyP: {
    fontSize: 14.5,
    lineHeight: 1.6,
    color: dim,
    margin: "16px 0 26px",
    maxWidth: 460,
  },
  suggestions: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
    width: "100%",
    maxWidth: 440,
  },
  chip: {
    textAlign: "left",
    background: panel,
    border: `1px solid ${line}`,
    borderRadius: 10,
    padding: "12px 15px",
    fontSize: 13.5,
    color: "#C9CDD8",
    cursor: "pointer",
    transition: "all .16s ease",
  },

  row: { display: "flex", gap: 11, marginBottom: 18, alignItems: "flex-start" },
  avatar: {
    width: 30,
    height: 30,
    minWidth: 30,
    borderRadius: 8,
    background: `linear-gradient(135deg, ${gold}, ${goldSoft})`,
    color: ink,
    display: "grid",
    placeItems: "center",
    fontSize: 14,
    marginTop: 2,
  },
  bubble: {
    maxWidth: "76%",
    padding: "13px 17px",
    borderRadius: 14,
    fontSize: 14.5,
    lineHeight: 1.62,
  },
  userBubble: {
    background: `linear-gradient(135deg, ${gold}, #B8923F)`,
    color: ink,
    borderBottomRightRadius: 4,
    fontWeight: 500,
  },
  botBubble: {
    background: panel,
    border: `1px solid ${line}`,
    color: "#DDE0E8",
    borderBottomLeftRadius: 4,
  },
  para: { margin: "0 0 9px" },
  li: { display: "flex", gap: 9, margin: "0 0 7px", alignItems: "flex-start" },
  liDot: { color: gold, marginTop: 1 },
  liNum: {
    color: ink,
    background: gold,
    minWidth: 19,
    height: 19,
    borderRadius: 5,
    fontSize: 11.5,
    fontWeight: 700,
    display: "grid",
    placeItems: "center",
    marginTop: 2,
  },
  thinking: { color: dim, fontStyle: "italic", marginRight: 4 },
  ellipsis: { display: "inline-flex", gap: 3 },

  error: {
    color: "#E89A8A",
    fontSize: 13,
    textAlign: "center",
    padding: "8px 0",
  },

  composer: {
    display: "flex",
    gap: 10,
    padding: "16px 28px 6px",
    borderTop: `1px solid ${line}`,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    resize: "none",
    background: panel,
    border: `1px solid ${line}`,
    borderRadius: 12,
    padding: "13px 15px",
    color: "#E8E9ED",
    fontSize: 14.5,
    fontFamily: "inherit",
    lineHeight: 1.5,
    maxHeight: 140,
    outline: "none",
  },
  sendBtn: {
    background: `linear-gradient(135deg, ${gold}, ${goldSoft})`,
    color: ink,
    border: "none",
    borderRadius: 12,
    padding: "13px 20px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all .16s ease",
  },
  sendBtnOff: { opacity: 0.4, cursor: "default" },

  // Verdict mode
  verdictWrap: { maxWidth: 760, margin: "0 auto", paddingBottom: 12 },
  newVerdictRow: { display: "flex", justifyContent: "flex-end", marginBottom: 12 },  newVerdictBtn: {
    background: "transparent",
    border: `1px solid ${line}`,
    color: dim,
    fontSize: 12.5,
    fontWeight: 600,
    padding: "7px 15px",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all .16s ease",
  },
  chatActions: {
    display: "flex",
    gap: 9,
    justifyContent: "flex-end",
    marginBottom: 16,
    paddingBottom: 14,
    borderBottom: `1px solid ${line}`,
  },
  chatActionBtn: {
    background: "transparent",
    border: `1px solid ${line}`,
    color: dim,
    fontSize: 12.5,
    fontWeight: 600,
    padding: "7px 15px",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all .16s ease",
  },
  verdictDecision: {
    background: panel,
    border: `1px solid ${line}`,
    borderLeft: `3px solid ${gold}`,
    borderRadius: 12,
    padding: "16px 18px",
    fontSize: 15.5,
    lineHeight: 1.5,
    color: "#EDEFF3",
    fontWeight: 500,
    marginBottom: 14,
  },
  verdictLabel: {
    display: "block",
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: gold,
    marginBottom: 7,
    fontWeight: 700,
  },
  verdictSummary: {
    fontSize: 14.5,
    lineHeight: 1.6,
    color: "#C3C8D4",
    fontStyle: "italic",
    padding: "0 4px 18px",
    borderBottom: `1px solid ${line}`,
    marginBottom: 20,
  },
  verdictGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(228px, 1fr))",
    gap: 11,
    marginBottom: 22,
  },
  vCard: {
    background: panel,
    border: `1px solid ${line}`,
    borderRadius: 12,
    padding: "13px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 9,
  },
  vCardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  vCardName: { fontSize: 13.5, fontWeight: 600, color: "#EFF0F3" },
  callBadge: {
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: 0.6,
    padding: "3px 7px",
    borderRadius: 6,
    border: "1px solid",
    whiteSpace: "nowrap",
  },
  vReasoning: { fontSize: 12.5, lineHeight: 1.55, color: "#C0C5D1" },
  vRisk: {
    fontSize: 11.5,
    lineHeight: 1.5,
    color: "#9CA2B0",
    borderTop: `1px solid ${line}`,
    paddingTop: 8,
  },
  vRiskLabel: {
    display: "inline-block",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 1,
    color: "#E8978A",
    marginRight: 6,
  },
  consensus: {
    background: "linear-gradient(135deg, rgba(201,162,75,0.1), rgba(201,162,75,0.03))",
    border: `1px solid rgba(201,162,75,0.3)`,
    borderRadius: 12,
    padding: "16px 18px",
    fontSize: 14.5,
    lineHeight: 1.62,
    color: "#E4E7EE",
  },
  consensusLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: gold,
    fontWeight: 700,
    marginBottom: 8,
  },
  exportRow: { display: "flex", justifyContent: "center", gap: 10, marginTop: 20, flexWrap: "wrap" },
  exportBtn: {
    background: "transparent",
    border: `1px solid ${gold}`,
    color: goldSoft,
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 22px",
    borderRadius: 9,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all .16s ease",
  },
  savedBtnOn: {
    background: "rgba(201,162,75,0.14)",
    cursor: "default",
  },

  // Alternatives
  altWrap: { marginTop: 24 },
  altHeader: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: gold,
    fontWeight: 700,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: `1px solid ${line}`,
  },
  altCard: {
    display: "flex",
    gap: 13,
    background: panel,
    border: `1px solid ${line}`,
    borderRadius: 11,
    padding: "14px 16px",
    marginBottom: 10,
    alignItems: "flex-start",
  },
  altNum: {
    minWidth: 26,
    height: 26,
    borderRadius: 7,
    background: `linear-gradient(135deg, ${gold}, ${goldSoft})`,
    color: ink,
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    fontSize: 13,
    marginTop: 1,
  },
  altBody: { flex: 1 },
  altMove: {
    fontSize: 14.5,
    fontWeight: 600,
    color: "#EFF0F3",
    lineHeight: 1.45,
    marginBottom: 5,
  },
  altRationale: { fontSize: 13, lineHeight: 1.55, color: "#B6BBC8" },
  altChamp: { color: gold, fontStyle: "italic" },

  // Saved verdicts
  savedHeader: {
    fontSize: 16,
    fontWeight: 700,
    color: goldSoft,
    marginBottom: 16,
    fontFamily: "'Georgia', serif",
  },
  savedCard: {
    display: "flex",
    alignItems: "stretch",
    background: panel,
    border: `1px solid ${line}`,
    borderRadius: 11,
    marginBottom: 10,
    overflow: "hidden",
  },
  savedCardMain: { flex: 1, padding: "14px 16px", cursor: "pointer" },
  savedDecision: {
    fontSize: 14.5,
    color: "#EAECF1",
    lineHeight: 1.45,
    marginBottom: 7,
  },
  savedMeta: {
    display: "flex",
    gap: 12,
    fontSize: 11.5,
    color: dim,
    fontFamily: "Arial, sans-serif",
  },
  savedTally: { color: gold },
  savedRemove: {
    border: "none",
    borderLeft: `1px solid ${line}`,
    background: "transparent",
    color: dim,
    fontSize: 13,
    padding: "0 15px",
    cursor: "pointer",
  },
  disclaimer: {
    textAlign: "center",
    fontSize: 11,
    color: "#565B68",
    padding: "4px 0 14px",
  },
};

const KEYFRAMES = `
  @keyframes pulse { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
  @keyframes blink { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
`;

window.WealthCouncil = WealthCouncil;
