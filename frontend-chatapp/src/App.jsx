import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? "http://localhost:2405" : window.location.origin);

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }
  return body;
}

function getOtherParticipant(conversation, userId) {
  return conversation?.participants?.find((participant) => participant._id !== userId);
}

function getInitials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

function Avatar({ person, size = "", online = false }) {
  return (
    <span className={`avatar ${size} ${person?.profilepicture ? "has-photo" : ""}`}>
      {person?.profilepicture
        ? <img src={person.profilepicture} alt="" />
        : getInitials(person?.fullname || person?.username)}
      {online && <i className="online-dot" />}
    </span>
  );
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ fullname: "", username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await request(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      onAuthenticated(user);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand brand-light"><span className="brand-mark">D</span> Dialexi</div>
        <div className="story-copy">
          <p className="eyebrow">Dialexi — A little closer, with every message.</p>
          <h1>Make room for<br /><em>real</em> conversation.</h1>
          <p className="story-note">The best things are said one message at a time.</p>
          <div className="story-decoration" aria-hidden="true">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <span className="orbit-core">✳</span>
            <span className="orbit-label">say it<br />like you mean it</span>
          </div>
        </div>
        <span className="story-footer">YOUR PEOPLE. YOUR MOMENTS. YOUR SPACE.</span>
      </section>
      <section className="auth-panel">
        <div className="auth-mobile-brand brand"><span className="brand-mark">V</span> Dialexi</div>
        <div className="auth-card">
          <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "A FRESH START"}</p>
          <h2>{mode === "login" ? "Good to see you." : "Come on in."}</h2>
          <p className="auth-subtitle">
            {mode === "login" ? "Your conversations are right where you left them." : "Create an account and find your people."}
          </p>
          <form onSubmit={submit}>
            {mode === "register" && (
              <>
                <label>
                  Your name
                  <input name="fullname" value={form.fullname} onChange={update} placeholder="Alex Morgan" autoComplete="name" required maxLength={80} />
                </label>
                <label>
                  Username
                  <input name="username" value={form.username} onChange={update} placeholder="alexmorgan" autoComplete="username" minLength={3} maxLength={24} pattern="[a-zA-Z0-9_.]+" required />
                </label>
              </>
            )}
            <label>
              Email address
              <input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" autoComplete="email" required />
            </label>
            <label>
              Password
              <input name="password" type="password" value={form.password} onChange={update} placeholder="At least 8 characters" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={72} required />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary auth-submit" disabled={busy}>
              {busy ? "One moment…" : mode === "login" ? "Sign in" : "Create your account"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p className="auth-switch">
            {mode === "login" ? "New around here?" : "Already have an account?"}
            {" "}<button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
        <p className="auth-footnote">PRIVATE BY DESIGN <span>·</span> MADE FOR YOUR PEOPLE</p>
      </section>
    </main>
  );
}

function ChatApp({ user, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState([]);
  const [showPeople, setShowPeople] = useState(false);
  const [draft, setDraft] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const socketRef = useRef(null);
  const activeIdRef = useRef(activeId);
  const endOfMessagesRef = useRef(null);
  activeIdRef.current = activeId;
  const activeConversation = conversations.find((conversation) => conversation._id === activeId);
  const otherPerson = getOtherParticipant(activeConversation, user._id);

  async function refreshConversations() {
    const result = await request("/api/conversations");
    setConversations(result);
    return result;
  }

  useEffect(() => {
    refreshConversations().catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    const client = io(API_URL, { withCredentials: true });
    socketRef.current = client;
    client.on("connect", () => setConnected(true));
    client.on("disconnect", () => setConnected(false));
    client.on("connect_error", () => {
      setConnected(false);
      setError("Live updates could not connect. You can still send messages; try refreshing to reconnect.");
    });
    client.on("conversation:message", (message) => {
      setConversations((current) => current.map((conversation) =>
        conversation._id === message.conversation
          ? { ...conversation, lastMessage: message, updatedAt: message.createdAt }
          : conversation,
      ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
      if (message.conversation === activeIdRef.current) {
        setMessages((current) => current.some((item) => item._id === message._id) ? current : [...current, message]);
      }
    });
    return () => {
      client.disconnect();
      socketRef.current = null;
    };
  }, [user._id]);

  useEffect(() => {
    if (!activeId || !socketRef.current) return undefined;
    socketRef.current.emit("conversation:join", activeId);
    return () => socketRef.current?.emit("conversation:leave", activeId);
  }, [activeId, connected]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    setError("");
    setMessages([]);
    request(`/api/conversations/${activeId}/messages`)
      .then((result) => {
        if (!cancelled) {
          setMessages((current) => {
            const merged = new Map(result.messages.map((message) => [message._id, message]));
            current.forEach((message) => merged.set(message._id, message));
            return [...merged.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          });
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    return () => { cancelled = true; };
  }, [activeId]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!showPeople || normalizedQuery.length < 2) {
      setPeople([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      request(`/api/users?search=${encodeURIComponent(normalizedQuery)}`)
        .then((result) => { if (!cancelled) setPeople(result); })
        .catch((searchError) => { if (!cancelled) setError(searchError.message); });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, showPeople]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function selectConversation(conversationId) {
    setActiveId(conversationId);
    setMobileChatOpen(true);
    setError("");
  }

  async function startConversation(person) {
    setError("");
    try {
      const existing = conversations.find((conversation) =>
        conversation.participants.some((participant) => participant._id === person._id),
      );
      if (existing) {
        await selectConversation(existing._id);
      } else {
        const created = await request("/api/conversations", {
          method: "POST",
          body: JSON.stringify({ participantId: person._id }),
        });
        await refreshConversations();
        await selectConversation(created._id);
      }
      setShowPeople(false);
      setQuery("");
    } catch (startError) {
      setError(startError.message);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeId) return;
    setDraft("");
    setError("");
    try {
      const message = await request(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setMessages((current) => current.some((item) => item._id === message._id) ? current : [...current, message]);
      setConversations((current) => current.map((conversation) =>
        conversation._id === activeId
          ? { ...conversation, lastMessage: message, updatedAt: message.createdAt }
          : conversation,
      ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
    } catch (sendError) {
      setDraft(text);
      setError(sendError.message);
    }
  }

  async function logout() {
    try {
      await onLogout();
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery || showPeople) return conversations;
    return conversations.filter((conversation) => {
      const person = getOtherParticipant(conversation, user._id);
      return `${person?.fullname} ${person?.username}`.toLowerCase().includes(normalizedQuery);
    });
  }, [conversations, query, showPeople, user._id]);

  return (
    <main className={`chat-shell ${mobileChatOpen ? "mobile-chat-open" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <a className="brand" href="/" aria-label="Dialexi home"><span className="brand-mark">D</span> Dialexi</a>
          <button className="icon-button compose-button" title="Find someone" aria-label="Find someone" onClick={() => { setShowPeople(true); setQuery(""); }}>
            <span>＋</span>
          </button>
        </div>
        <div className="sidebar-intro">
          <p className="eyebrow">YOUR LITTLE CORNER</p>
          <h1>Conversations<span>.</span></h1>
        </div>
        <div className="sidebar-controls">
          <div className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a conversation"
              aria-label="Find a conversation or person"
            />
            {query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}
          </div>
          <div className="list-tabs">
            <button className={!showPeople ? "selected" : ""} onClick={() => setShowPeople(false)}>Messages</button>
            <button className={showPeople ? "selected" : ""} onClick={() => { setShowPeople(true); setQuery(""); }}>People <span>＋</span></button>
          </div>
        </div>
        {error && !activeId && <div className="sidebar-error" role="alert">{error}</div>}
        <div className="conversation-list">
          {showPeople && query.trim().length >= 2 ? (
            people.length ? people.map((person) => (
              <button className="conversation-item person-result" key={person._id} onClick={() => startConversation(person)}>
                <Avatar person={person} />
                <span className="conversation-copy"><strong>{person.fullname}</strong><small>@{person.username}</small></span>
                <span className="person-add">＋</span>
              </button>
            )) : <div className="list-empty">{query.length >= 2 ? "No people found yet." : "Keep typing to search."}</div>
          ) : showPeople ? (
            <div className="search-prompt"><span>✳</span><strong>Find your people</strong><p>Search by name or username to start a conversation.</p></div>
          ) : filteredConversations.length ? filteredConversations.map((conversation) => {
            const person = getOtherParticipant(conversation, user._id);
            return (
              <button
                className={`conversation-item ${activeId === conversation._id ? "active" : ""}`}
                key={conversation._id}
                onClick={() => selectConversation(conversation._id)}
              >
                <Avatar person={person} online={connected && activeId === conversation._id} />
                <span className="conversation-copy">
                  <strong>{person?.fullname || person?.username || "Conversation"}</strong>
                  <small>{conversation.lastMessage?.text || `@${person?.username || ""}`}</small>
                </span>
                <span className="conversation-meta">
                  {conversation.lastMessage?.createdAt && <time>{formatTime(conversation.lastMessage.createdAt)}</time>}
                  {activeId === conversation._id && <i />}
                </span>
              </button>
            );
          }) : (
            <div className="list-empty">
              <span className="empty-spark">✳</span>
              <strong>{query ? "No conversations found." : "It's quiet in here."}</strong>
              <p>{query ? "Try another name." : "Find someone and say hello."}</p>
              {!query && <button className="text-button" onClick={() => { setShowPeople(true); setQuery(""); }}>Start a conversation <span>↗</span></button>}
            </div>
          )}
        </div>
        <div className="sidebar-account">
          <Avatar person={user} size="avatar-small" />
          <span className="account-name"><strong>{user.fullname}</strong><small>@{user.username}</small></span>
          <div className="account-menu-container">
            <button
              className="icon-button account-menu-button"
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              title="Account menu"
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
            >
              ···
            </button>
            {accountMenuOpen && (
              <div className="account-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    logout();
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <section className="chat-main">
        {activeConversation && otherPerson ? (
          <>
            <header className="chat-header">
              <button className="back-button" onClick={() => setMobileChatOpen(false)} aria-label="Back to conversations">←</button>
              <Avatar person={otherPerson} />
              <div className="header-person"><h2>{otherPerson.fullname}</h2><span><i className={connected ? "status-online" : ""} />{connected ? "Live chat enabled" : `@${otherPerson.username}`}</span></div>
              <div className="header-note"><span>✳</span> Make it a good one</div>
              <button className="icon-button header-menu" title="Conversation details" aria-label="Conversation details">···</button>
            </header>
            <div className="message-area">
              <div className="message-intro">
                <Avatar person={otherPerson} size="avatar-large" />
                <p>THIS IS THE BEGINNING OF SOMETHING GOOD</p>
                <h3>You and {otherPerson.fullname.split(" ")[0]}.</h3>
                <span>Say hello and see where the conversation goes.</span>
              </div>
              {loadingMessages && <p className="message-status">Loading your conversation…</p>}
              {!loadingMessages && messages.map((message, index) => {
                const ownMessage = message.sender?._id === user._id || message.sender === user._id;
                const previousMessage = messages[index - 1];
                const sameSender = previousMessage && String(previousMessage.sender?._id || previousMessage.sender) === String(message.sender?._id || message.sender);
                return (
                  <div className={`message-row ${ownMessage ? "mine" : ""} ${sameSender ? "grouped" : ""}`} key={message._id}>
                    {!ownMessage && !sameSender && <Avatar person={message.sender} size="avatar-tiny" />}
                    {!ownMessage && sameSender && <span className="avatar-spacer" />}
                    <div className="message-bubble">
                      <p>{message.text}</p>
                      <time>{formatTime(message.createdAt)}</time>
                    </div>
                  </div>
                );
              })}
              <div ref={endOfMessagesRef} />
            </div>
            {error && <div className="inline-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
            <form className="composer" onSubmit={sendMessage}>
              <span className="composer-spark" aria-hidden="true">✳</span>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${otherPerson.fullname.split(" ")[0]}…`} maxLength={5000} aria-label="Write a message" />
              <span className="character-count">{draft.length > 4500 ? `${draft.length}/5000` : ""}</span>
              <button className="send-button" disabled={!draft.trim()} aria-label="Send message">↑</button>
            </form>
          </>
        ) : (
          <div className="welcome-panel">
            <div className="welcome-topline"><span>Dialexi / YOUR SPACE</span><span>NO RUSH. JUST REAL.</span></div>
            <div className="welcome-art" aria-hidden="true">
              <span className="welcome-ring ring-a" />
              <span className="welcome-ring ring-b" />
              <span className="welcome-center">D<span>.</span></span>
              <span className="float-dot dot-a">✳</span>
              <span className="float-dot dot-b">✦</span>
            </div>
            <p className="eyebrow">A SPACE FOR THE GOOD STUFF</p>
            <h2>Every great conversation<br />starts <em>somewhere.</em></h2>
            <p className="welcome-copy">Pick up where you left off, or find someone new to talk to.<br />The little moments make the best stories.</p>
            <button className="button button-dark" onClick={() => { setShowPeople(true); setQuery(""); }}>Find your people <span>↗</span></button>
            <span className="welcome-caption">A GOOD PLACE TO BE.</span>
          </div>
        )}
      </section>
    </main>
  );
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");

  async function restoreSession() {
    setCheckingSession(true);
    setSessionError("");
    try {
      setUser(await request("/api/auth/me"));
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
      } else {
        setSessionError(error.message);
      }
    } finally {
      setCheckingSession(false);
    }
  }

  useEffect(() => { restoreSession(); }, []);

  async function logout() {
    await request("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  if (checkingSession) {
    return <main className="loading-screen"><span className="brand-mark">D</span><p>Making yourself at home…</p></main>;
  }
  if (sessionError) {
    return (
      <main className="loading-screen">
        <span className="brand-mark">D</span>
        <p role="alert">{sessionError}</p>
        <button className="button button-primary" onClick={restoreSession}>Try again</button>
      </main>
    );
  }
  return user ? <ChatApp user={user} onLogout={logout} /> : <AuthScreen onAuthenticated={setUser} />;
}
